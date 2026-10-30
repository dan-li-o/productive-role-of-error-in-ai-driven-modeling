# Social preview cards

The image that appears when someone shares a link to the site (LinkedIn, Slack,
Bluesky, X, Facebook, email apps). Every page gets one automatically:

- **`make_cards.py`** builds a 1200×630 card for each page from its front matter. It uses
  `card.html`, the site's colors (the `--nb-*` tokens in `notebook.scss`) and the fonts in
  `fonts/`. It checks each card's layout and writes `images/social/<page>.png`, plus
  `images/social/cards.json`.
- **`social-card.lua`** (in the project root) points each page's `og:image` and
  `twitter:image` at its card when Quarto renders.
- **`.githooks/pre-push`** runs `make_cards.py` before every push and commits new cards.

This folder starts with `_`, so Quarto never publishes it.

## Setup (once per clone)

```sh
git config core.hooksPath .githooks
pip install pyyaml websocket-client
```

You also need Chromium or Chrome. The script looks for `chromium` or `google-chrome`;
set `$CHROME` to use another.

## What goes on a card

| Page | Label | Title | Subtitle |
| --- | --- | --- | --- |
| Homepage | `In [1]: Productive Error` | the headline in `index.qmd`, with the word it types first struck out | none |
| Other pages | the navbar text, e.g. `get_involved()` (else the file name) | Productive Error | `description:` |
| News posts | `news()` | the post's `title:` | its date · News |

To change any of these, add `social-card:` to the page's front matter:

```yaml
social-card:
  sub: "The team and advisory board"   # also: label, title, alt
```

`social-card: false` gives the page the default card. A page that sets its own `image:`
keeps that image.

Writing rules: titles of 40 characters or fewer read best. The subtitle is one short line,
about 45 characters. Long titles shrink to fit, down to a limit.

## Layout check

A card fails, and the push stops, if:

- the title still needs more than 3 lines at the smallest size
- the subtitle needs more than 2 lines
- a word is wider than the card
- text falls outside the margins
- the fonts didn't load

The message names the page and the fix, usually a shorter `social-card: {sub: …}`.

## By hand

```sh
python3 _social-cards/make_cards.py           # build new or changed cards
python3 _social-cards/make_cards.py --all     # rebuild all (e.g. after changing card.html)
python3 _social-cards/make_cards.py --verify  # no browser: list stale cards
```

Only cards whose content, template, fonts or colors changed are rebuilt. Open
`_social-cards/out/preview.html` to see every card at once.

## Checking after publishing

Paste a page link into LinkedIn's Post Inspector or opengraph.xyz. Platforms cache
previews for days, so check before announcing, and use those tools to make a
platform fetch a page again.
