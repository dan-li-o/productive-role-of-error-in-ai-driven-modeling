#!/usr/bin/env python3
"""Measure the rendered site against the layout and type standard.

README, "Layout and type", is the standard; check_style.py checks the source,
this checks what a browser draws. It serves _site, opens every page in
headless Chromium at several widths and reports:

  edge       the text's left edge is on the grid's column-3 line, the same on
             every page at each width
  leading    every visible line height is a whole number of 4px rhythm units
             (scaled with the reader's text size)
  baselines  facts keys on their answers' first lines, prompts on their code
             and output, News dates on their titles (within 0.5px)
  flow       the "How we work" icons and arrows on one centre line (1px)
  cards      Get involved buttons level within a row (0.5px)
  region     text ends at the text region (column 12); boxes of short items
             (cards, boxed facts, callouts) at the box region (column 10)
  bleed      nothing in the content leaves the frame
  scroll     no sideways scrolling
  js         no uncaught script errors

Needs Chromium and the websocket-client package (pip install websocket-client).

    quarto render
    python3 _checks/check_layout.py                      # check _site
    python3 _checks/check_layout.py --shots DIR          # and save screenshots
    python3 _checks/check_layout.py --base https://productive-error.org --shots DIR
                                                         # the live site, e.g. "before"
Chromium: $CHROMIUM, else chromium, chromium-browser, google-chrome or
/snap/bin/chromium. A snap Chromium needs its profile under
~/snap/chromium/common (done automatically).
"""

from __future__ import annotations

import argparse
import base64
import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

try:
    import websocket  # websocket-client
except ImportError:
    sys.exit("check_layout.py needs websocket-client: pip install websocket-client")

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "_site"

# (label, width, pointer). "mouse" reports hover: hover and a fine pointer;
# "touch" reports hover: none, like a phone or tablet.
VIEWS = [
    ("1280", 1280, "mouse"),
    ("1024", 1024, "mouse"),
    ("768 mouse", 768, "mouse"),
    ("768 touch", 768, "touch"),
    ("390", 390, "touch"),
]
MOUSE_FLAGS = ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,"
               "primaryPointerType=4,availablePointerTypes=4"]

MEASURE_JS = r"""
(() => {
  const html = document.documentElement;
  const root = parseFloat(getComputedStyle(html).fontSize);
  const unit = 4 * root / 17;
  const vw = html.clientWidth;
  const out = { unit, vw, problems: [], edge: null, scroll: html.scrollWidth - vw };
  const name = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return t ? `${s} "${t}"` : s;
  };
  const visible = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // Where the first line's baseline sits: a zero-size inline-block placed
  // before the element's first glyph has its bottom on the baseline. The text
  // (without its leading white space, which a probe would un-collapse) is
  // wrapped in a span first, so the probe stays inline in a flex or grid row.
  const baseline = el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let text = walker.nextNode();
    if (!text) return null;
    const parent = text.parentNode;
    text = text.splitText(text.data.search(/\S/));
    const wrap = document.createElement('span');
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    text.replaceWith(wrap);
    wrap.append(probe, text);
    const y = probe.getBoundingClientRect().bottom;
    wrap.replaceWith(text);
    parent.normalize();
    return y;
  };

  // edge: where text starts, and where the grid says it should.
  const first = ['.prose-cell .cell-content h1', '.prose-cell .cell-content', '#title-block-header h1', 'main.content h1', 'main.content p']
    .map(s => [...document.querySelectorAll(s)].find(visible)).find(Boolean);
  if (first) out.edge = Math.round(first.getBoundingClientRect().left * 100) / 100;
  const frame = Math.min(vw, 1040);
  const gutter = vw < 640 ? 16 : 24, gap = gutter;
  const col = (frame - 2 * gutter - 11 * gap) / 12;
  const touchTablet = matchMedia('(hover: none) and (min-width: 640px) and (max-width: 899.98px)').matches;
  const marginCols = vw < 640 ? 0 : touchTablet ? 3 : 2;
  out.expectedEdge = Math.round(((vw - frame) / 2 + gutter + marginCols * (col + gap)) * 100) / 100;

  // leading
  const skip = 'svg, script, style, noscript, .visually-hidden, .sr-only, .hero-type-cursor, .nb-progress, #quarto-search, .quarto-listing-category';
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest(skip)) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim());
    if (!own || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display.startsWith('inline') && cs.display !== 'inline-block' && cs.display !== 'inline-flex') {
      // An inline box sits in its parent's lines; only a taller one matters.
      const p = getComputedStyle(el.parentElement);
      if (cs.lineHeight === p.lineHeight || parseFloat(cs.lineHeight) <= parseFloat(p.lineHeight)) continue;
    }
    const lh = parseFloat(cs.lineHeight);
    const steps = lh / unit;
    if (cs.lineHeight === 'normal' || Math.abs(steps - Math.round(steps)) > 0.02) {
      const key = `${cs.fontSize}/${cs.lineHeight} ${name(el)}`;
      if (!seen.has(key)) { seen.add(key); out.problems.push(['leading', `${name(el)}: ${cs.fontSize} / ${cs.lineHeight} (${steps.toFixed(2)} units)`]); }
    }
  }

  // baselines
  const pair = (kind, a, b, tol = 0.5) => {
    if (!a || !b || !visible(a) || !visible(b)) return;
    const ya = baseline(a), yb = baseline(b);
    if (ya == null || yb == null) return;
    if (Math.abs(ya - yb) > tol) out.problems.push([kind, `${name(a)} vs ${name(b)}: ${(ya - yb).toFixed(2)}px`]);
  };
  for (const dt of document.querySelectorAll('dl.facts dt, .facts dl dt')) pair('baselines', dt, dt.nextElementSibling);
  if (vw >= 640) {
    for (const cell of document.querySelectorAll('.code-cell')) {
      pair('baselines', cell.querySelector('.cell-prompt'), cell.querySelector('.code-input'));
      pair('baselines', cell.querySelector('.output-prompt'), cell.querySelector('.cell-output'));
    }
    for (const post of document.querySelectorAll('.quarto-post')) pair('baselines', post.querySelector('.metadata'), post.querySelector('.listing-title'));
  }

  // flow: one centre line per row layout
  for (const row of document.querySelectorAll('.hf-row')) {
    if (getComputedStyle(row).gridTemplateColumns.split(' ').length < 2 || !visible(row)) continue;
    const mid = r => (r.top + r.bottom) / 2;
    const centres = [];
    for (const k of row.children) {
      if (k.matches('.hf-node')) centres.push([name(k), mid(k.querySelector('.hf-icon').getBoundingClientRect())]);
      else if (k.matches('.hf-col')) {
        const icons = [...k.querySelectorAll('.hf-icon')].map(i => mid(i.getBoundingClientRect()));
        centres.push([name(k), (Math.min(...icons) + Math.max(...icons)) / 2]);
      } else centres.push([name(k), mid(k.getBoundingClientRect())]);
    }
    const ref = centres[0][1];
    for (const [n, y] of centres) if (Math.abs(y - ref) > 1) out.problems.push(['flow', `${n}: ${(y - ref).toFixed(2)}px off the first icon's centre`]);
  }

  // cards: buttons level across a row
  const rows = {};
  for (const b of document.querySelectorAll('.involve-grid .project-card .button')) {
    const card = b.closest('.project-card').getBoundingClientRect();
    (rows[Math.round(card.top)] ||= []).push(b.getBoundingClientRect().top);
  }
  for (const tops of Object.values(rows)) if (Math.max(...tops) - Math.min(...tops) > 0.5) out.problems.push(['cards', `buttons ${(Math.max(...tops) - Math.min(...tops)).toFixed(2)}px apart`]);

  // region: text ends at the text region's right edge (column 12; the
  // content's edge on phones), and boxes of short items at the box region's
  // (column 10). bleed: nothing in the content leaves the frame.
  const main = document.querySelector('main.content');
  if (main && out.edge != null) {
    const span = n => vw < 640 ? null : (n - marginCols) * col + (n - 1 - marginCols) * gap;
    const textRight = vw < 640 ? main.getBoundingClientRect().right : out.expectedEdge + span(12);
    const boxRight = vw < 640 ? textRight : out.expectedEdge + span(10);
    const frameLeft = (vw - frame) / 2, frameRight = frameLeft + frame;
    const floating = el => { for (let e = el; e && e !== main; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'absolute' || p === 'fixed') return true; } return false; };
    const textual = 'p, li, dd, dt, h1, h2, h3, h4, hr, table, blockquote, .involve-grid, .facts dl, dl.facts, .person, .advisor-grid, .partner-list, .quarto-post, .callout, .questions, .marked';
    const wide = '.prose-cell h1, .code-input, .how-flow, .hf-tip, .branch-tip, .git-lanes, nav';
    for (const el of main.querySelectorAll(textual)) {
      if (el.closest(wide) || !visible(el) || floating(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > textRight + 0.5) out.problems.push(['region', `${name(el)} ends at ${r.right.toFixed(1)}px, past the text region (${textRight.toFixed(1)}px)`]);
    }
    for (const el of main.querySelectorAll('.involve-grid, .facts.boxed dl, dl.facts.boxed, .callout')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > boxRight + 0.5) out.problems.push(['region', `${name(el)} ends at ${r.right.toFixed(1)}px, past the box region (${boxRight.toFixed(1)}px)`]);
    }
    for (const el of main.querySelectorAll('*')) {
      if (el.closest('svg, .hf-tip, .branch-tip') || !visible(el) || floating(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < frameLeft - 0.5 || r.right > frameRight + 0.5) out.problems.push(['bleed', `${name(el)} spans ${r.left.toFixed(1)}-${r.right.toFixed(1)}px, outside the frame (${frameLeft.toFixed(1)}-${frameRight.toFixed(1)}px)`]);
    }
  }

  if (out.scroll > 0) out.problems.push(['scroll', `page is ${out.scroll}px wider than the window`]);
  return JSON.stringify(out);
})()
"""


class Browser:
    """A headless Chromium driven over the DevTools protocol."""

    def __init__(self, exe: str, extra: list[str]):
        port = free_port()
        base = Path.home() / "snap/chromium/common" if "/snap/" in os.path.realpath(exe) else None
        self.profile = Path(tempfile.mkdtemp(prefix="check-layout-", dir=base))
        self.proc = subprocess.Popen(
            [exe, "--headless=new", f"--remote-debugging-port={port}", f"--user-data-dir={self.profile}",
             "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", *extra, "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1))
                break
            except OSError:
                time.sleep(0.1)
        else:
            self.close()
            raise SystemExit(f"Chromium ({exe}) didn't start")
        self.ws = websocket.create_connection(info["webSocketDebuggerUrl"], suppress_origin=True, timeout=60)
        self.next_id = 0
        target = self.call("Target.createTarget", url="about:blank")["targetId"]
        self.session = self.call("Target.attachToTarget", targetId=target, flatten=True)["sessionId"]
        self.errors: list[str] = []  # uncaught script errors since the last open()
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce"}])

    def call(self, method: str, **params):
        self.next_id += 1
        msg = {"id": self.next_id, "method": method, "params": params}
        if getattr(self, "session", None):
            msg["sessionId"] = self.session
        self.ws.send(json.dumps(msg))
        while True:
            reply = json.loads(self.ws.recv())
            if reply.get("method") == "Runtime.exceptionThrown":
                d = reply["params"]["exceptionDetails"]
                self.errors.append(d.get("exception", {}).get("description", d.get("text", "?")).split("\n")[0])
            if reply.get("id") == self.next_id:
                if "error" in reply:
                    raise RuntimeError(f"{method}: {reply['error']}")
                return reply.get("result", {})

    def evaluate(self, expr: str):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description", r["exceptionDetails"]))
        return r["result"].get("value")

    def open(self, url: str, width: int):
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=900, deviceScaleFactor=1, mobile=False)
        self.call("Page.navigate", url=url)
        for _ in range(200):
            if self.evaluate("document.readyState") == "complete":
                break
            time.sleep(0.05)
        # Fonts, notebook.js's title row, and every homepage cell shown run.
        self.evaluate("document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))")
        self.evaluate("document.querySelectorAll('.code-cell').forEach(c => c.classList.add('is-revealed')); 0")
        self.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

    def screenshot(self, path: Path, width: int):
        # A window as tall as the page, rather than captureBeyondViewport,
        # which lays the page out differently mid-capture (About's lanes).
        h = self.evaluate("document.documentElement.scrollHeight")
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=h, deviceScaleFactor=1, mobile=False)
        self.evaluate("new Promise(r => setTimeout(r, 300))")
        data = self.call("Page.captureScreenshot", format="png")["data"]
        path.write_bytes(base64.b64decode(data))
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=900, deviceScaleFactor=1, mobile=False)

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass
        self.proc.terminate()
        self.proc.wait(timeout=10)
        shutil.rmtree(self.profile, ignore_errors=True)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def find_chromium() -> str:
    for c in [os.environ.get("CHROMIUM"), "chromium", "chromium-browser", "google-chrome", "/snap/bin/chromium"]:
        if c and (shutil.which(c) or Path(c).exists()):
            return shutil.which(c) or c
    sys.exit("No Chromium found; set CHROMIUM to its path")


def pages() -> list[str]:
    """Rendered pages that still have a source (skips stale files in _site)."""
    out = []
    for p in sorted(SITE.glob("*.html")) + sorted(SITE.glob("news/*.html")):
        rel = p.relative_to(SITE)
        if (ROOT / rel.with_suffix(".qmd")).exists():
            out.append(rel.as_posix())
    return out


def serve() -> tuple[str, http.server.ThreadingHTTPServer]:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(SITE))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", free_port()), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{server.server_address[1]}", server


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--base", help="check this site instead of serving _site (e.g. the live site)")
    ap.add_argument("--shots", type=Path, help="save a full-page screenshot of every page and width here")
    ap.add_argument("--text-size", type=float, default=16,
                    help="the browser's default text size in px (16 is every browser's default)")
    ap.add_argument("--page", action="append", help="only these pages (e.g. about.html); repeatable")
    args = ap.parse_args()

    if not SITE.exists():
        sys.exit("_site not found: run quarto render first")
    server = None
    base = args.base.rstrip("/") if args.base else None
    if not base:
        base, server = serve()
    names = args.page or pages()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)

    exe = find_chromium()
    browsers = {"mouse": Browser(exe, MOUSE_FLAGS), "touch": Browser(exe, [])}
    for b in browsers.values():
        if args.text_size != 16:
            b.call("Page.setFontSizes", fontSizes={"standard": int(args.text_size), "fixed": int(args.text_size * 13 / 16)})

    failures = 0
    try:
        for label, width, pointer in VIEWS:
            b = browsers[pointer]
            edges = {}
            print(f"\n== {width}px, {pointer}")
            for page in names:
                b.errors.clear()
                b.open(f"{base}/{page}", width)
                m = json.loads(b.evaluate(MEASURE_JS))
                m["problems"] += [["js", e] for e in dict.fromkeys(b.errors)]
                edges[page] = (m["edge"], m["expectedEdge"])
                for kind, msg in m["problems"]:
                    print(f"  FAIL {page}: [{kind}] {msg}")
                    failures += 1
                if args.shots:
                    b.screenshot(args.shots / f"{page.replace('/', '_')[:-5]}-{label.replace(' ', '-')}.png", width)
            expected = next(iter(edges.values()))[1]
            for page, (edge, _) in edges.items():
                if edge is None or abs(edge - expected) > 0.5:
                    print(f"  FAIL {page}: [edge] text starts at {edge}px; the grid's text line is {expected}px")
                    failures += 1
            print(f"  text line {expected}px; {len(names)} pages measured")
    finally:
        for b in browsers.values():
            b.close()
        if server:
            server.shutdown()

    print(f"\n{failures} problem(s)." if failures else "\nLayout check passed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
