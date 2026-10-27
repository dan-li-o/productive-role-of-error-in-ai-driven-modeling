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
  `title`, `date` and `description`. The News page lists posts newest first
  and builds an RSS feed (`news.xml`).
- **Email addresses** are never written out in full. Use
  `<span class="email-obfuscate" data-user="name" data-domain="example.org">name [at] example.org</span>`.

To preview locally (optional): install [Quarto](https://quarto.org) and run
`quarto preview`.

## Domain

The site is live at <https://productive-error.org/>. The domain is set in the
repo's **Settings → Pages** (with **Enforce HTTPS**), and its DNS points at
GitHub Pages. Because the site deploys from a workflow, it needs no `CNAME`
file. `site-url` in `_quarto.yml` must match the domain: link previews, the
sitemap and full page addresses are built from it. The old
`dan-li-o.github.io/productive-role-of-error-in-ai-driven-modeling/` address
redirects to the domain.

Still to do: set up `contact@productive-error.org` forwarding (registrar or
Cloudflare Email Routing) and replace the addresses in the footer, Get
involved and Accessibility pages.

## Before launch

- [ ] Ask CUNY's IRB whether fieldwork and interview wording counts as
      recruitment material
- [ ] Short site name, domain and wordmark (the site currently uses
      "Productive Error")
- [ ] Ryan checks the plain-language wording of the FourCastNet → SFNO case
      (homepage cells 3–5 and About; "It assumed the Earth was flat" glosses
      the "Euclidean geometry" point in O'Loughlin et al. 2025, Sect. 4.2)
- [ ] Ryan OKs the globe animation in homepage cell 3: an illustration
      inspired by Bonev et al. 2023, Fig. 4, not model output (its note says so)
- [ ] Ryan and Matthew approve their bios and photos (`people.qmd`, `people/`;
      bios adapted from the proposal, photos from Ryan's press page and the
      NCAR Library directory) and Matthew's listed email (mayernik [at] ucar.edu)
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
- [ ] Workshop date: About says "about July–September 2027" (proposal months
      10–12), Workshop says "end of the first year"; earlier notes say fall 2027
      at Queens College. Use one date everywhere
- [ ] About acknowledgments: confirm "Research Foundation of CUNY – Queens
      College" with the QC grants office; name research sites and letter
      writers only after each agrees; add the IRB approval note under "Take
      part" once approval is granted, and check the consent sentence with the IRB
- [ ] Gavin Schmidt isn't named in the proposal: confirm he's on the advisory
      board (People page) before launch
- [ ] Share image (`share.png`, 1200×630) and enable `image:` in `_quarto.yml`
- [ ] Analytics (cookie-free: GoatCounter or Plausible)
- [ ] Mailing list (e.g. Buttondown), with sign-up on the homepage and Get
      involved, before the February 2027 call
- [ ] Workshop: date, venue, accessibility, fees, travel policy, code of
      conduct, upload service (Dropbox File Request or Google Form), consent and
      release form for recordings and slides
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
