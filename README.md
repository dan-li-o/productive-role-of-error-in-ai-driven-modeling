# The Productive Role of Error in AI-Driven Modeling

Quarto website for the Sloan Foundation project (October 1, 2026 – September
30, 2028). The homepage is a notebook that "runs" as visitors scroll; the
other pages are plain reading pages in the same style.

## How it's built

- Pages are Markdown (`.qmd`). Edit text directly, including in GitHub's web
  editor; every push to `main` re-renders and publishes the site
  (`.github/workflows/publish.yml`).
- `notebook.scss` holds the Jupyter-style look; `notebook.js` runs the
  homepage cells, assembles email links and adds the "Last updated" line.
- The homepage cells are hand-written divs in `index.qmd`; a comment at the
  top of that file explains how to edit them.
- **News:** add a file to `news/` named `YYYY-MM-DD-short-name.qmd` with a
  `title`, `date` and `description`. The News page lists posts newest first
  and builds an RSS feed (`news.xml`).
- **Email addresses** are never written out in full. Use
  `<span class="email-obfuscate" data-user="name" data-domain="example.org">name [at] example.org</span>`.

To preview locally (optional): install [Quarto](https://quarto.org) and run
`quarto preview`.

## Custom domain

1. Buy the domain; add a `CNAME` file containing it and list `CNAME` under
   `project.resources` in `_quarto.yml`.
2. Change `site-url` in `_quarto.yml` to `https://<domain>/`.
3. In the repo's **Settings → Pages**, set the custom domain and tick
   **Enforce HTTPS**. Point the domain's DNS at GitHub Pages.
4. Set up `contact@<domain>` forwarding (registrar or Cloudflare Email Routing)
   and replace the addresses in the footer, Get involved and Accessibility
   pages.

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
