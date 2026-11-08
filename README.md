# The Productive Role of Error in AI-Driven Modeling

Quarto website for the Sloan Foundation project (October 1, 2026 – September
30, 2028). The homepage is a notebook that "runs" as visitors scroll; the
other pages are plain reading pages in the same style.

## How it's built

- Pages are Markdown (`.qmd`). Edit text directly, including in GitHub's web
  editor; every push to `main` re-renders and publishes the site
  (`.github/workflows/publish.yml`).
- `notebook.scss` holds the Jupyter-style look; `notebook.js` runs the
  homepage cells, assembles email links and fills the header's title row:
  the "Last checkpoint" date (the render date, from `checkpoint.lua`) and the
  funder line.
- The homepage cells are hand-written divs in `index.qmd`; a comment at the
  top of that file explains how to edit them.
- **News:** add a file to `news/` named `YYYY-MM-DD-short-name.qmd` with a
  `title`, `date` and `description`. The News page lists posts newest first.
- **Email addresses** are never written out in full. Use
  `<span class="email-obfuscate" data-user="name" data-domain="example.org">name [at] example.org</span>`.
  Optional attributes turn it into a prefilled email: `data-subject`,
  `data-body` (`|` starts a new line, `{page}` becomes the page's address),
  `data-label` (link text in place of the address) and `data-class` (e.g.
  `button button-secondary`). Without JavaScript the span's own text shows.
  General enquiries go to `contact@`, website problems to `tech@`; the
  email-list sign-ups ("Keep me posted") arrive at `contact@` for now.
- **Facts list** (`.facts` in `notebook.scss`): wherever readers scan for who,
  what, when, where or how much, give each fact one line, a short code-style
  key beside its answer. Used on the homepage hero (`.facts .lead`: what, why),
  Workshop (`.facts .boxed`: when, where, who, format, call, support), job ads
  (`.facts .boxed`: role, who, when, pay, funding, with, apply by, link) and
  About's acknowledgments (`.facts`: funder, host, partner, sites). Rules:
  lowercase keys of eight characters at most, the same word for the same idea
  on every page (always `when`); values of 15 words at most, no full stop;
  three to eight rows; state each fact once, not again in the prose beside it.
  In Quarto, a definition list inside `::: {.facts .boxed}`; when a value needs
  an id or a span (the job ad's `#ra-deadline`), raw HTML:
  `<dl class="facts boxed">`. A new job ad copies the research assistant's list
  and changes only the values.
- **"How we work" icon flow** (`.how-flow`): in the homepage's `run(project)`
  cell its steps appear in order each time the cell runs. There, steps marked
  `.has-tip` show a bubble on hover (desktop only), and workshop and papers
  are links (`.is-link`); small badges on the circles say which is which. The
  screen-reader sentence above the flow must say what the bubbles say. About
  has a plain, still copy (no bubbles or links): keep its steps and notes in
  step with the homepage's.

To preview locally (optional): install [Quarto](https://quarto.org) and run
`quarto preview`.

## Layout and type

Every page follows one standard. Two scripts check it (see **Checks** below),
so new pages and components keep to it. The tokens are in `:root` at the top
of `notebook.scss`.

**The frame: 12 columns.** Every page, its header and its footer sit in one
frame: 1040px at most, centred, with a 24px gutter at each side (16px on
phones), split into 12 columns with 24px between them (`--nb-col-gap`).

| Columns | Region | Holds |
|---|---|---|
| 1–2 | margin | the homepage's `In [n]:` prompts, News dates, About's timeline lanes; empty on reading pages |
| 3–10 | text (`--nb-text-w`) | everything that holds text: titles, headings, paragraphs, lists, tables, cards, boxed facts, marked blocks, callouts, rules. 653px on desktop: about 73 characters of body text |
| 3–12 | wide | things that aren't running text: code boxes and outputs, figures, the icon flow, the timeline's lanes, the homepage headline |
| 11–12 | contents | a table of contents, only on a long page that opts in with `toc: true` (off site-wide; 1024px and wider) |

- **One text line, one text edge.** Text starts on the column-3 line and
  ends by column 10's right edge, on every page at every width, so nothing
  jumps sideways between pages and nothing reaches past the text beside it.
  Running text is also capped at `--nb-measure` (`min(64ch, --nb-text-w)`), so
  small type keeps a short line. Don't widen it: lines longer than about 75
  characters get harder to read. A page looks wider only where it has wide
  items, like the homepage's code.
- **Hang the box, not the text.** Code boxes, boxed facts, callouts and
  marked blocks move left into the gutter by their border plus padding
  (`--hang`). Their text stays on the text line. About's timeline hangs its
  rail and lanes into the margin columns the same way.
- **Touch tablets** (640–899px, no hover) take columns 1–3 for the margin, to
  fit the run button beside `In [n]:`; text is then columns 4–10. **Phones**
  (under 640px) have one column. The margin collapses there, prompts and
  dates sit above their cells and titles, and text takes the full width.
- **Breakpoints:** 640, 900, 992 (Quarto's menu) and 1024px only.

**Type: one scale.** A major third (×1.25) from the 17px body, used in half
steps. Sizes are in `rem`, so they follow the reader's browser text size
(`html` is 106.25%, which is 17px at the default). Use a token, never a
number.

| Token | Size | Line | For |
|---|---|---|---|
| `--nb-size-tiny` | 12.2px | 16px | badges, the year tag, bubble titles |
| `--nb-size-meta` | 13.6px | 20px | footer, notes, tooltips, the contents, dates |
| `--nb-size-small` | 15.2px | 24px | code, prompts, captions, card text, menus |
| `--nb-size-text` | 17px | 28px | body text, lists, facts answers |
| `--nb-size-lead` | 19px | 28px | the hero facts, merge entries, the site title |
| `--nb-size-h3` | 21.25px | 28px | h3, card titles, News titles |
| `--nb-size-h2` | 23.8–26.6px | ≈1.2em | h2 (fluid between 390 and 1040px wide) |
| `--nb-size-h1` | 29.7–33.2px | ≈1.2em | page titles |
| `--nb-size-display` | 37.1–51.9px | ≈1.08em | the homepage headline only |

Each size has a matching line height, `--nb-lh-*` (the same name). Headings
take `--nb-lh-tight`, which is 1.2em rounded to the 4px unit, so it suits a
fluid size.

**Rhythm: a 4px unit.** Every line height is a whole number of units
(`--nb-u`, 4px at the default text size). So is every space: margins, padding
and gaps use `--nb-space-1` to `-8` (4, 8, 12, 16, 24, 32, 48, 64px), or the
grid's `--nb-col-gap` and `--nb-gutter`. Headings have more space above than
below, so each sits with its text. A label beside text shares its baseline
(facts keys, prompts, News dates) or its centre line (the icon flow).

**Typesetting.**
- Curly quotes and apostrophes: ’ ‘ “ ”. Markdown converts them, but in raw
  HTML (```` ```{=html} ```` blocks) you type them yourself.
- Dates: "2 November 2026" everywhere (`date-format` in `_quarto.yml`), and
  "Tuesday 1 December 2026" with a weekday.
- Lists indent 1.25em (numbered lists 1.6em). Headings use
  `text-wrap: balance`, paragraphs `text-wrap: pretty`.

**Marked block** (`.marked`): the site's one way to set a passage off with a
bar down its left side: a 3px brand-blue rule, 12px from the text, hung into
the gutter. Used for About's "where we are" pointer and each job opening on
Get involved. Add the class to any block, in Markdown
(`::: {.opening .marked}`) or HTML (`<p class="head-pointer marked">`). Keep
any extra class for that component's own type or behaviour, but never draw
another left bar.

**Adding a component.** Pick the region it spans: text (anything with words
in it) or wide (anything else). In the text region, cap it with
`max-width: var(--nb-text-w)`. Set its type with one size token and its line
height with the matching `--nb-lh-*`. Space it with `--nb-space-*`. Give a
box around text a `--hang`: it moves left into the gutter by that much and
ends at the text region's edge (`max-width: calc(var(--nb-text-w) +
var(--hang))`), so its text stays on the line and its border doesn't reach
past the text. Phones have no room, so boxes don't hang there. A grid of
cards (Get involved) is such a box, with `--nb-col-gap` between the cards;
card titles take `--nb-size-h3`, card text `--nb-size-small`, and buttons
stay the standard 44px. Give the element a class in the page and style it in
`notebook.scss`; inline `style=""` may only set custom properties (like `--d`
in the icon flow).

**Exceptions.** Some values are deliberately off the scale: a 1–3px hairline
or optical nudge, a 44px touch target, a logo's own size. Write the value with
a comment on the same line saying why; the checker accepts a commented
declaration.

### Checks

```sh
python3 _checks/check_style.py           # the CSS and the pages (runs before every push)
quarto render
python3 _checks/check_style.py --site    # also the rendered text: straight quotes
pip install websocket-client
python3 _checks/check_layout.py          # measures the rendered site in Chromium
```

- `check_style.py` reads `notebook.scss` and the `.qmd` pages. It needs only
  Python, and checks sizes, line heights, spacing, fonts, undefined tokens,
  breakpoints, inline styles, hand-drawn left bars (use `.marked`) and (with
  `--site`) straight quotes. The
  pre-push hook runs it and stops a push that breaks a rule. CI runs it with
  `--site` and warns.
- `check_layout.py` serves `_site` and opens every page in headless Chromium
  at 1280, 1024, 768 (mouse and touch) and 390px. It checks the text line,
  the text region's right edge (nothing that holds text reaches past it),
  that nothing leaves the frame, line heights on the unit, baselines (facts,
  prompts, News), the icon flow's centre line, Get involved's buttons,
  sideways scrolling and script errors.
  Run it by hand after a layout change. Options: `--shots DIR` saves
  full-page screenshots; `--base https://productive-error.org` measures the
  live site (a "before"); `--text-size 20` checks a larger browser text size.

## Domain

The site is live at <https://productive-error.org/>. The domain is set in the
repo's **Settings → Pages** (with **Enforce HTTPS**), and its DNS points at
GitHub Pages. Because the site deploys from a workflow, it needs no `CNAME`
file. `site-url` in `_quarto.yml` must match the domain: link previews, the
sitemap and full page addresses are built from it. The old
`dan-li-o.github.io/productive-role-of-error-in-ai-driven-modeling/` address
redirects to the domain.

Email: `contact@productive-error.org` forwards to Ryan and
`tech@productive-error.org` to the site builder (Cloudflare Email Routing).
Send a test to each before relying on them, and after any change to the
routing.

## Before launch

- [ ] Ask CUNY's IRB whether fieldwork and interview wording counts as
      recruitment material
- [ ] Ryan shows the error-story wording (option A: Get involved and
      homepage) to the Queens College IRB office. Switch to option B (research
      use with consent) once the interview study is approved
- [ ] Short site name, domain and wordmark (the site currently uses
      "Productive Error")
- [x] Ryan checks the plain-language wording of the FourCastNet → SFNO case
      (homepage cells 3–5 and About; "It assumed the Earth was flat" glosses
      the "Euclidean geometry" point in O'Loughlin et al. 2025, Sect. 4.2).
      Final: the case keeps "10 days" and "It assumed the Earth was flat."
- [ ] Ryan OKs the globe animation in homepage cell 3: an illustration
      inspired by Bonev et al. 2023, Fig. 4, not model output (its note says so)
- [ ] Ryan and Matthew approve their bios and photos (`people.qmd`, `people/`;
      bios adapted from the proposal, photos from Ryan's press page and
      Matthew's NCAR profile) and Matthew's listed email (mayernik [at] ucar.edu)
- [ ] Each advisor confirms their one-line description and affiliation
      (`people.qmd`; Paul Edwards retired from Stanford in January 2026)
- [ ] Institution logos on People (`logos/`): check each institution's logo
      guidelines, or ask, before launch. Marks came from each institution's
      website or Wikimedia Commons; the NASA insignia is left out (it needs
      NASA's approval), so GISS has a text tile
- [ ] About timeline (`about.qmd`): Ryan reads every entry; each one-line
      summary simplifies a published argument. Check especially Schickore 2005
      (the nerve-fiber example comes from the proposal, not the abstract),
      Parker 2008 (the list of error sources), Winsberg 2018 (paraphrased; the
      phrase "a socially organized kind of science" couldn't be confirmed, so it
      isn't quoted), Rudin 2019, Buijsman 2022 (reworded: the paper defines
      what makes an XAI explanation genuine) and Lin and Jackson 2023 (applied
      data science work, not ML organizations in general)
- [ ] About timeline: Ryan approves publishing the August 2025 pilot-interview
      finding and the in-progress antifragility manuscript entry; add the year
      and venue if the manuscript is accepted. Add a January 2024 NSF NCAR
      fieldwork entry only if Ryan confirms it
- [ ] About timeline: dates checked against sources (CMIP began in 1995, per
      Meehl et al. 2000; Bommer et al. is the 2024 journal version of a 2023
      preprint). Optional: a "proposal submitted" entry before the merge
- [x] Workshop date: fall 2027, in New York City, used everywhere
- [ ] About acknowledgments: confirm "Research Foundation of CUNY – Queens
      College" with the QC grants office; name research sites and letter
      writers only after each agrees; add the IRB approval note on Get
      involved (`contact.qmd`, next to the error-story wording) once approval is
      granted, and check the consent sentence with the IRB
- [x] Gavin Schmidt isn't named in the proposal: confirmed he's on the
      advisory board (People page)
- [ ] Share image (`share.png`, 1200×630) and enable `image:` in `_quarto.yml`
- [ ] Analytics (cookie-free: GoatCounter or Plausible)
- [ ] Mailing list (e.g. Buttondown), with sign-up on the homepage and Get
      involved, before the February 2027 call
- [ ] Workshop: exact dates, venue (then restore Venue accessibility on the
      Workshop page), fees, travel support details (the site says "we aim
      to"; keep it guarded until the budget is settled), code of conduct (link
      an existing one once adopted), upload service (Dropbox File Request or
      Google Form), consent and release form for recordings and slides
- [ ] Ask Sloan's communications team about logo use; tell them when the site
      launches and before the workshop
- [ ] Permission for any partner logos
- [ ] Decide who writes and approves News posts (aim for one a month)
- [ ] QA: keyboard-only and screen-reader pass (VoiceOver, NVDA), broken-link
      check, iPhone and Android, Lighthouse 90+ for accessibility and
      performance
- [ ] After the grant: prepay the domain, name who renews it, deposit a
      snapshot on Zenodo or the Internet Archive

## Licenses

Site code: MIT (`LICENSE`). Written content: CC BY 4.0.
