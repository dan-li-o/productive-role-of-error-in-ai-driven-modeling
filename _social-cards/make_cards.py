#!/usr/bin/env python3
"""Build the site's social preview cards (1200x630 PNG) from its pages.

Every page Quarto renders gets a card made from its own front matter, so new
pages and news posts get one automatically. Cards are written to
images/social/<slug>.png, with images/social/cards.json listing them for
social-card.lua, which points each page's og:image at its card.

Usage:
    python3 _social-cards/make_cards.py                 # build new or changed cards
    python3 _social-cards/make_cards.py --from-git HEAD # same, from committed files (the pre-push hook)
    python3 _social-cards/make_cards.py --verify        # no browser: list stale cards, exit 1 if any
    python3 _social-cards/make_cards.py --all           # rebuild every card

Needs Python 3 with PyYAML, plus websocket-client and Chromium or Chrome to
render ($CHROME, or chromium / google-chrome on PATH). See README.md.
"""
import argparse
import base64
import datetime
import functools
import hashlib
import html
import http.server
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_DIR = ROOT / "images" / "social"
MANIFEST = OUT_DIR / "cards.json"
PREVIEW = HERE / "out" / "preview.html"

# Pages with no card of their own (or with `social-card: false`) share this one.
DEFAULT_CARD = {"kind": "card", "label": "productive_error()", "title": "Productive Error",
                "sub": "How errors in AI-driven scientific models lead to new knowledge"}
SITE_TITLE = "Productive Error"
# Rendered pages that never get shared.
SKIP = {"404.qmd"}
# The site's colors, read from notebook.scss so cards follow the theme.
TOKENS = ["--nb-page", "--nb-text", "--nb-text-muted", "--nb-brand", "--nb-in-prompt", "--nb-red"]


# ---------- Reading the site ----------

class Source:
    """Reads project files from the working tree, or from a commit."""

    def __init__(self, rev=None):
        self.rev = rev

    def read(self, path):
        if self.rev:
            return subprocess.run(["git", "show", f"{self.rev}:{path}"], cwd=ROOT, check=True,
                                  capture_output=True, text=True).stdout
        return (ROOT / path).read_text(encoding="utf-8")

    def pages(self):
        if self.rev:
            names = subprocess.run(["git", "ls-tree", "-r", "--name-only", self.rev], cwd=ROOT, check=True,
                                   capture_output=True, text=True).stdout.split("\n")
        else:
            names = [p.relative_to(ROOT).as_posix() for p in [*ROOT.glob("*.qmd"), *ROOT.glob("news/*.qmd")]]
        # Quarto skips files and folders starting with _ or .
        pattern = re.compile(r"^(news/)?[^/_.][^/]*\.qmd$")
        return sorted(n for n in names if pattern.match(n) and n not in SKIP)


def front_matter(text):
    match = re.match(r"---\s*\n(.*?)\n---\s*\n", text, re.S)
    return (yaml.safe_load(match.group(1)) or {}) if match else {}


def nav_labels(quarto_yml):
    """href -> navbar text, e.g. "contact.qmd" -> "Get involved"."""
    navbar = yaml.safe_load(quarto_yml).get("website", {}).get("navbar", {})
    labels = {}
    for item in navbar.get("left", []) + navbar.get("right", []):
        if isinstance(item, dict) and "href" in item and "text" in item:
            # Drop markup and what it wraps, e.g. the workshop's year.
            labels[item["href"]] = re.sub(r"<(\w+)[^>]*>.*?</\1>", "", item["text"]).strip()
    return labels


def theme_tokens(scss):
    root = re.search(r":root\s*\{(.*?)\n\}", scss, re.S).group(1)
    values = dict(re.findall(r"(--nb-[\w-]+):\s*([^;]+);", root))

    def resolve(value):
        ref = re.fullmatch(r"var\((--nb-[\w-]+)\)", value.strip())
        return resolve(values[ref.group(1)]) if ref else value.strip()

    return {name: resolve(values[name]) for name in TOKENS}


def snake(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def home_spec(index_qmd):
    """The homepage card is its headline, with the word the page types first struck out."""
    h1 = re.search(r'<h1[^>]*data-type-wrong="([^"]+)"[^>]*>.*?class="hero-type-final">(.*?)</span>', index_qmd, re.S)
    if not h1:
        raise SystemExit("index.qmd: couldn't find the headline (<h1 data-type-wrong=…> with .hero-type-final)")
    wrong, sentence = h1.group(1), html.unescape(re.sub(r"<[^>]+>", "", h1.group(2))).strip()
    before, right = sentence.rsplit(" ", 1)
    return {"kind": "home", "label": SITE_TITLE, "before": before, "wrong": wrong, "right": right,
            "alt": f"{before} {wrong}, crossed out, {right}"}


def card_alt(spec):
    if spec["title"] == SITE_TITLE:
        return f"{SITE_TITLE}: {spec['sub']}" if spec.get("sub") else SITE_TITLE
    return f"{spec['title']}. {spec['sub']}" if spec.get("sub") else spec["title"]


def news_date(path, fm):
    value = fm.get("date") or re.match(r"news/(\d{4}-\d{2}-\d{2})", path).group(1)
    date = value if isinstance(value, datetime.date) else datetime.date.fromisoformat(str(value)[:10])
    return f"{date.day} {date:%B %Y}"


def page_spec(path, text, nav):
    """The card for one page, or None if it uses the default card."""
    fm = front_matter(text)
    custom = fm.get("social-card", {})
    if custom is False:
        return None
    custom = custom if isinstance(custom, dict) else {}
    if path == "index.qmd":
        spec = home_spec(text)
    elif path.startswith("news/"):
        spec = {"kind": "card", "label": "news()", "title": fm.get("title", ""), "sub": f"{news_date(path, fm)} · News"}
    else:
        spec = {"kind": "card", "label": snake(nav.get(path) or pathlib.Path(path).stem) + "()",
                "title": SITE_TITLE, "sub": fm.get("description", "")}
    spec.update({k: str(custom[k]) for k in ("label", "title", "sub") if k in custom})
    if spec["kind"] != "home":
        spec["alt"] = str(custom.get("alt") or card_alt(spec))
    return spec


def slug(path):
    return path[:-len(".qmd")].replace("/", "-")


def collect(source):
    nav = nav_labels(source.read("_quarto.yml"))
    tokens = theme_tokens(source.read("notebook.scss"))
    cards = {"default": dict(DEFAULT_CARD, alt=card_alt(DEFAULT_CARD), page="(pages without their own card)")}
    for path in source.pages():
        spec = page_spec(path, source.read(path), nav)
        if spec:
            cards[slug(path)] = dict(spec, page=path)
    engine = hashlib.sha256()
    for f in sorted([HERE / "card.html", *(HERE / "fonts").glob("*.*")]):
        engine.update(f.read_bytes())
    engine.update(json.dumps(tokens, sort_keys=True).encode())
    for card in cards.values():
        card["tokens"] = tokens
        card["hash"] = hashlib.sha256(engine.digest() + json.dumps(
            {k: v for k, v in card.items() if k not in ("page", "alt")}, sort_keys=True).encode()).hexdigest()[:16]
    return cards


def load_manifest():
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8")).get("cards", {})
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def stale(cards, manifest):
    """Slugs whose PNG is missing or was made from a different spec, and PNGs no page uses."""
    changed = [s for s, c in cards.items()
               if manifest.get(s, {}).get("hash") != c["hash"] or not (OUT_DIR / f"{s}.png").exists()]
    orphans = sorted({p.stem for p in OUT_DIR.glob("*.png")} - set(cards))
    return changed, orphans


# ---------- Rendering ----------

def find_chrome():
    for name in filter(None, [os.environ.get("CHROME"), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]):
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("make_cards.py: no Chromium or Chrome found; set $CHROME to one.")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Browser:
    """Headless Chromium driven over the DevTools protocol, with _social-cards/ served on localhost."""

    def __enter__(self):
        import websocket  # only needed to render, so --verify works without it
        handler = functools.partial(QuietHandler, directory=str(HERE))
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

        chrome = find_chrome()
        # Snap Chromium can only use profile folders inside its own snap directory.
        if "/snap/" in os.path.realpath(chrome) or chrome.startswith("/snap/"):
            base = pathlib.Path.home() / "snap" / "chromium" / "common"
            base.mkdir(parents=True, exist_ok=True)
            self.profile = tempfile.mkdtemp(prefix="social-cards-", dir=base)
        else:
            self.profile = tempfile.mkdtemp(prefix="social-cards-")
        port = free_port()
        self.proc = subprocess.Popen(
            [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
             "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1200,630",
             f"--remote-debugging-port={port}", f"--user-data-dir={self.profile}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 30
        while True:
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2))
                page = next(t for t in targets if t["type"] == "page")
                break
            except Exception:
                if time.time() > deadline:
                    self.__exit__(None, None, None)
                    raise SystemExit("make_cards.py: Chromium didn't start.")
                time.sleep(0.2)
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], suppress_origin=True, timeout=30)
        self.next_id = 0
        self.call("Emulation.setDeviceMetricsOverride", width=1200, height=630, deviceScaleFactor=1, mobile=False)
        self.call("Page.navigate", url=f"http://127.0.0.1:{self.server.server_port}/card.html")
        while self.evaluate("document.readyState === 'complete' && typeof renderCard === 'function'") is not True:
            time.sleep(0.1)
        return self

    def call(self, method, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == self.next_id:
                if "error" in message:
                    raise RuntimeError(f"{method}: {message['error']}")
                return message["result"]

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", expression=expression, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"].get("exception", {}).get("description", "script error"))
        return result["result"].get("value")

    def render(self, spec):
        report = self.evaluate(f"renderCard({json.dumps(spec)})")
        shot = self.call("Page.captureScreenshot", format="png",
                         clip={"x": 0, "y": 0, "width": 1200, "height": 630, "scale": 1})
        return report, base64.b64decode(shot["data"])

    def __exit__(self, *exc):
        if getattr(self, "ws", None):
            self.ws.close()
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.server.shutdown()
        shutil.rmtree(self.profile, ignore_errors=True)


def layout_problems(card, report):
    """What's wrong with a rendered card, as advice for the page's author."""
    problems = []
    if not report["fonts"]:
        problems.append("the card fonts didn't load (check _social-cards/fonts/)")
    if report["titleLines"] > report["maxTitleLines"]:
        problems.append(f"the title runs to {report['titleLines']} lines even at {report['titleSize']}px; "
                        f"shorten it with social-card: {{title: …}} (40 characters or fewer read best)")
    if report["subLines"] > report["maxSubLines"]:
        problems.append(f"the subtitle runs to {report['subLines']} lines; add a shorter one with "
                        f"social-card: {{sub: …}} (one short line, about 45 characters)")
    if report["overflow"]:
        problems.append(f"a word is too wide for the card ({', '.join(report['overflow'])})")
    if not report["inSafeArea"] and not problems:
        problems.append("the text doesn't fit inside the card's margins; shorten the title or subtitle")
    return problems


# ---------- Output ----------

def write_manifest(cards):
    data = {"note": "Written by _social-cards/make_cards.py; read by social-card.lua. Don't edit by hand.",
            "cards": {s: {"file": f"{s}.png", "page": c["page"], "alt": c["alt"], "hash": c["hash"]}
                      for s, c in sorted(cards.items())}}
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if not MANIFEST.exists() or MANIFEST.read_text(encoding="utf-8") != text:
        MANIFEST.write_text(text, encoding="utf-8")


def write_preview(cards):
    PREVIEW.parent.mkdir(exist_ok=True)
    items = "".join(
        f'<figure><img src="../../images/social/{s}.png" alt="{html.escape(c["alt"])}" width="600" height="315">'
        f'<figcaption><b>{html.escape(c["page"])}</b><br>{html.escape(c["alt"])}</figcaption></figure>'
        for s, c in sorted(cards.items()))
    PREVIEW.write_text(
        '<!doctype html><meta charset="utf-8"><title>Social cards</title>'
        "<style>body{font:15px system-ui,sans-serif;margin:24px;background:#eee}"
        "main{display:grid;grid-template-columns:repeat(auto-fill,600px);gap:24px}"
        "figure{margin:0}img{display:block;box-shadow:0 1px 3px #0003}figcaption{margin-top:6px}</style>"
        f"<main>{items}</main>", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-git", metavar="REV", help="read pages from this commit instead of the working tree")
    parser.add_argument("--verify", action="store_true", help="only report stale cards; exit 1 if any")
    parser.add_argument("--all", action="store_true", help="rebuild every card")
    args = parser.parse_args()

    cards = collect(Source(args.from_git))
    manifest = load_manifest()
    changed, orphans = stale(cards, manifest)
    if args.all:
        changed = list(cards)

    if args.verify:
        for s in changed:
            print(f"stale: {cards[s]['page']} ({s}.png)")
        for s in orphans:
            print(f"unused: images/social/{s}.png")
        if changed or orphans:
            print("Run python3 _social-cards/make_cards.py and commit images/social/.")
            return 1
        print(f"social cards: all {len(cards)} up to date")
        return 0

    failures = {}
    if changed:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        with Browser() as browser:
            for s in changed:
                card = cards[s]
                report, png = browser.render({k: v for k, v in card.items() if k not in ("page", "hash", "alt")})
                problems = layout_problems(card, report)
                if problems:
                    failures[card["page"]] = problems
                    continue
                (OUT_DIR / f"{s}.png").write_bytes(png)
                print(f"built images/social/{s}.png  ← {card['page']}")
    for s in orphans:
        (OUT_DIR / f"{s}.png").unlink()
        print(f"removed images/social/{s}.png (no page uses it)")

    if failures:
        # Keep the old entries for failed cards, so the next run tries them again.
        for page, problems in failures.items():
            print(f"\n{page}: the social card doesn't fit.", file=sys.stderr)
            for p in problems:
                print(f"  - {p}", file=sys.stderr)
        kept = {s: c for s, c in cards.items() if c["page"] not in failures}
        kept.update({s: dict(cards[s], **manifest[s]) for s in cards if cards[s]["page"] in failures and s in manifest})
        write_manifest(kept)
        return 1
    write_manifest(cards)
    write_preview(cards)
    if not changed and not orphans:
        print(f"social cards: all {len(cards)} up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
