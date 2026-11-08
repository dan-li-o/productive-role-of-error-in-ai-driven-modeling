#!/usr/bin/env python3
"""Check the site's CSS and pages against the layout and type standard.

README, "Layout and type", is the standard; this script enforces the parts
that can be read from the source. Standard library only, so it runs from the
pre-push hook and in CI without installing anything.

    python3 _checks/check_style.py            # notebook.scss and the .qmd pages
    python3 _checks/check_style.py --site     # also the rendered _site/*.html

Rules (notebook.scss, outside the :root token blocks, @keyframes and custom
properties):
  size      font-size is a --nb-size-* token
  leading   line-height is an --nb-lh-* token
  spacing   margin, padding and gap use tokens (--nb-space-*, --nb-col-gap,
            --nb-gutter, --hang ...): no literal px, rem or em lengths
  font      font-family is var(--nb-font-code), inherit or monospace
  marked    a 3px left rule belongs to .marked only (the shared marked block)
  token     every var(--nb-*) used is defined
  break     media and container queries use the standard breakpoints
A declaration that must break a rule (a hairline, an optical nudge, a touch
target) carries a comment on the same line saying why; that exempts it.

Rules (pages):
  inline    style="" attributes in .qmd files set custom properties only
  quotes    (--site) no straight quotes or apostrophes in the rendered text
"""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCSS = ROOT / "notebook.scss"
JS = ROOT / "notebook.js"

# Widths the layout changes at (README, "Layout and type"). 992 is Quarto's
# own menu collapse; 900 touch tablets.
BREAKPOINTS = {640, 900, 992, 1024}

SPACING = re.compile(r"^(margin|padding)(-[a-z-]+)?$|^(gap|row-gap|column-gap)$")
LENGTH = re.compile(r"(?<![\w-])-?\d*\.?\d+(px|rem|em|pt)\b")
ZERO_OK = {"0", "inherit", "initial", "unset"}


def strip_comments(text: str) -> tuple[str, set[int]]:
    """Blank out /* */ and // comments, keeping line numbers. Returns the text
    and the set of (1-based) line numbers that held a comment."""
    out, lines_with_comment = [], set()
    i, line, n = 0, 1, len(text)
    while i < n:
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            chunk = text[i:j]
            for k in range(chunk.count("\n") + 1):
                lines_with_comment.add(line + k)
            out.append(re.sub(r"[^\n]", " ", chunk))
            line += chunk.count("\n")
            i = j
        elif text.startswith("//", i) and (i == 0 or text[i - 1] in " \t\n") :
            j = text.find("\n", i)
            j = n if j < 0 else j
            lines_with_comment.add(line)
            out.append(" " * (j - i))
            i = j
        else:
            if text[i] == "\n":
                line += 1
            out.append(text[i])
            i += 1
    return "".join(out), lines_with_comment


def strip_vars(value: str) -> str:
    """Remove var(...) groups (with nesting), leaving the literal parts."""
    out, i = [], 0
    while i < len(value):
        if value.startswith("var(", i):
            depth, j = 0, i + 3
            while j < len(value):
                depth += value[j] == "("
                depth -= value[j] == ")"
                j += 1
                if depth == 0:
                    break
            i = j
        else:
            out.append(value[i])
            i += 1
    return "".join(out)


def declarations(text: str):
    """Yield (selector stack, property, value, last line) for each declaration."""
    stack: list[str] = []
    buf_start, line = 0, 1
    i = 0
    while i < len(text):
        c = text[i]
        if c in "{};":
            segment = text[buf_start:i]
            seg_line_end = line
            if c == "{":
                stack.append(" ".join(segment.split()))
            elif stack:
                decl = segment.strip()
                if ":" in decl and not decl.startswith("@"):
                    prop, value = decl.split(":", 1)
                    yield list(stack), prop.strip(), " ".join(value.split()), seg_line_end
            if c == "}" and stack:
                stack.pop()
            buf_start = i + 1
        if c == "\n":
            line += 1
        i += 1


def check_scss() -> list[str]:
    raw = SCSS.read_text()
    text, commented = strip_comments(raw)
    problems: list[str] = []

    defined = set(re.findall(r"(--nb-[\w-]+)\s*:", text))
    if JS.exists():  # properties notebook.js sets at runtime
        defined |= set(re.findall(r"""['"](--nb-[\w-]+)['"]""", JS.read_text()))

    def report(line: int, rule: str, msg: str):
        problems.append(f"notebook.scss:{line}: [{rule}] {msg}")

    for stack, prop, value, line in declarations(text):
        if any(s.startswith(":root") or s.startswith("@keyframes") for s in stack):
            continue
        if prop.startswith("--") or prop.startswith("$"):
            continue
        exempt = line in commented
        v = re.sub(r"\s*!important$", "", value)

        if prop == "font-size":
            ok = v in ZERO_OK or re.fullmatch(r"var\(--nb-size-[\w-]+\)", v)
            if not ok and not exempt:
                report(line, "size", f"font-size: {value} is not a --nb-size-* token")
        elif prop == "line-height":
            ok = v in ZERO_OK or re.fullmatch(r"var\(--nb-lh-[\w-]+\)", v)
            if not ok and not exempt:
                report(line, "leading", f"line-height: {value} is not an --nb-lh-* token")
        elif SPACING.match(prop):
            literal = LENGTH.search(strip_vars(v))
            if literal and not exempt:
                report(line, "spacing", f"{prop}: {value} has a literal length ({literal.group(0)}); "
                       "use the spacing tokens, or say why in a comment on the line")
        elif prop in ("border-left", "border-inline-start") and re.match(r"3px\s+solid", v):
            if stack[-1] != ".marked" and not exempt:
                report(line, "marked", f"{stack[-1]} draws its own left bar; add class .marked to the block instead")
        elif prop == "font-family":
            ok = v in {"var(--nb-font-code)", "inherit", "monospace"}
            if not ok and not exempt:
                report(line, "font", f"font-family: {value}; use var(--nb-font-code) or inherit")

    for m in re.finditer(r"var\((--nb-[\w-]+)", text):
        if m.group(1) not in defined:
            report(text.count("\n", 0, m.start()) + 1, "token", f"{m.group(1)} is used but never defined")

    for m in re.finditer(r"@(media|container)[^{]*", text):
        for w in re.findall(r"width:\s*([\d.]+)px", m.group(0)):
            px = float(w)
            if not any(abs(px - b) < 0.05 or abs(px - (b - 0.02)) < 0.005 for b in BREAKPOINTS):
                report(text.count("\n", 0, m.start()) + 1, "break",
                       f"{w}px is not a standard breakpoint ({', '.join(map(str, sorted(BREAKPOINTS)))})")
    return problems


def check_pages() -> list[str]:
    problems = []
    for path in sorted(ROOT.glob("*.qmd")) + sorted(ROOT.glob("*/*.qmd")):
        if path.parts[len(ROOT.parts)].startswith(("_", ".")):
            continue
        for n, line in enumerate(path.read_text().splitlines(), 1):
            for style in re.findall(r'style="([^"]*)"', line):
                for decl in filter(None, (d.strip() for d in style.split(";"))):
                    if not decl.startswith("--"):
                        problems.append(f"{path.relative_to(ROOT)}:{n}: [inline] style=\"{style}\": "
                                        "set custom properties only; give the element a class instead")
    return problems


class TextScan(HTMLParser):
    """Collects text outside code, scripts and styles, with line numbers."""
    SKIP = {"code", "pre", "script", "style", "kbd", "samp", "textarea", "svg", "math"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.found: list[tuple[int, str]] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if not self.depth and re.search(r"['\"]", data):
            self.found.append((self.getpos()[0], data.strip()))


def check_site() -> list[str]:
    site = ROOT / "_site"
    if not site.exists():
        return ["_site: not rendered; run quarto render first"]
    problems = []
    for path in sorted(site.glob("*.html")) + sorted(site.glob("news/*.html")):
        scan = TextScan()
        scan.feed(path.read_text())
        for line, text in scan.found:
            problems.append(f"{path.relative_to(ROOT)}:{line}: [quotes] straight quote in \"{text[:70]}\"; "
                            "use ’ ‘ “ ” (in raw HTML, type them)")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--site", action="store_true", help="also check the rendered _site")
    args = ap.parse_args()
    problems = check_scss() + check_pages() + (check_site() if args.site else [])
    for p in problems:
        print(p)
    if problems:
        print(f"\n{len(problems)} problem(s). The standard: README, \"Layout and type\".", file=sys.stderr)
        return 1
    print("Style check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
