# thomaslab.eu

Site for the **Thomas Lab** — the digital chemistry group of Dr Dean Thomas FHEA,
Research Fellow at the University of Glasgow.

No build step, no dependencies, no framework. Edit the files and push.

> **This branch is not deployed.** GitHub Pages publishes from `main`, which still
> serves the old single-page site at <https://deanthomas.eu>. Nothing here is live
> until the go-live steps at the bottom are carried out.

```text
index.html                 lab front page — hero, research, news carousel
about/index.html           About Dean — biography and the full history timeline
publications/index.html    publications, with the per-paper modals
media/index.html           video and animation carousel
contact/index.html         contact details
404.html                   error page, styled from the same stylesheet

assets/css/styles.css      all styling (hand-written)
assets/js/main.js          nav, tabs, modals, carousels, theme, scroll handlers
assets/css|js/swiper-*     vendored Swiper 6.5.8 — do not edit
assets/img/                images
assets/favicon/            favicons referenced by <link> and site.webmanifest
site.webmanifest           PWA manifest
CNAME                      the custom domain GitHub Pages serves this repo at
tools/                     local preview + pre-push verification (not part of the site)
```

Every page shares the same `<head>` assets, header and footer, but each carries its
**own** `<title>`, description, canonical URL and JSON-LD. `tools/check.py` fails the
build if two pages ever end up with the same title or canonical.

---

## Paths are root-relative

Every asset reference is `/assets/…`, never `assets/…`. This is load-bearing: a page at
`/about/` resolving a relative `assets/img/x.png` would request `/about/assets/img/x.png`
and 404. The same applies to the two theme-swapped SVG paths in `main.js`.

**When adding markup, always write `/assets/…`.** `tools/check.py` catches the mistake,
but only if you run it.

---

## Preview it before pushing

```bash
python tools/preview.py
```

Serves the site at <http://127.0.0.1:8000> and opens a browser.

**Do not check the site by double-clicking an `.html` file.** That opens it over
`file://`, where `/assets/…` resolves against the drive root (`C:/assets/…`) rather than
the site root, so *every* stylesheet, script and image silently 404s. `tools/preview.py`
serves from the repository root, which is what GitHub Pages does, and it also serves
`404.html` for unknown paths so you can check that too.

---

## Verify it before pushing

```bash
python tools/check.py                  # fast, needs only Python
python tools/check.py --live           # also loads every page in a real browser
python tools/check.py --live --shots   # ...and writes screenshots to .preview-shots/
```

Exit code is 0 when everything passes, 1 if anything **FAILS**. `WARN` never blocks — it
flags things worth a look.

Pages are **discovered**, not listed: any `index.html` in a new sub-directory is picked
up automatically, so adding a page never silently escapes the checks.

### What it catches

| Check | Why it matters |
| --- | --- |
| **local references resolve** | Every `src`/`href` exists **with matching case**. Windows is case-insensitive, GitHub Pages is not — so `CAS.jpg` referenced as `cas.jpg` looks perfect locally and 404s for every visitor. This class of bug is invisible in a local browser. |
| **internal anchors resolve** | Cross-page links carry fragments (`/about/#history`). The fragment points into a document the link does not live in, so a typo shows up as "loads at the top" rather than as an error — nothing in a local click-through reveals it. |
| **distinct page metadata** | A split site that copies one `<head>` everywhere gives every page the same title and canonical URL, which is worse for search than the single page was. |
| publications modal pairing | `main.js` pairs modal triggers to modals **by index**. If the selectors drift out of sync, clicking a row throws a `TypeError`. This actually happened: the trigger selector matched the Traditional list too, whose rows have no modal. |
| exactly one nav link starts active | Every nav link once hardcoded `active-link`, so the whole menu rendered highlighted. The highlight is now page-level, so exactly one — matching `aria-current` — is required. |
| `target=_blank` carries `rel` | Without `rel`, the opened tab gets a `window.opener` handle back to this page. |
| no empty `href=""` | Resolves to the current document, so the link silently reloads the page. |
| charset declared before any script | Otherwise the parser may have to restart. |
| site.webmanifest | Every field populated and every icon path actually resolving. |
| alt / iframe titles, unique ids, one `<h1>` per page | Screen-reader and validity basics. |
| HTML5 validity, escaped ampersands | Real parse errors, not pedantry. |
| CSS sanity | Balanced braces, no dangling selector fragments, no `var()` that is never declared. |
| unreferenced assets *(warn)* | Guards against unused images piling up again — 71 MB had accumulated. |
| assets over 2 MB *(warn)* | Oversized images to revisit. |
| `.DS_Store` not tracked | |

With `--live` it additionally serves the site and loads **every page** in Chromium,
asserting: HTTP 200, **zero uncaught JS errors**, no failed same-origin requests, every
image decodes, **no horizontal scrollbar from 320–1500 px**, the nav highlights the page
you are actually on, both carousels initialise, the news modal opens by keyboard and
closes on Escape, and no Traditional-tab row throws.

Loading every page matters more than it sounds: all five run the same `main.js`, so a
page that merely *lacks* a carousel or a modal is exactly where a new
"cannot read property of undefined" appears.

The `--live` checks need Playwright; without it they report `SKIP` rather than failing:

```bash
python -m pip install playwright beautifulsoup4 lxml html5lib
python -m playwright install chromium
```

`beautifulsoup4` and `html5lib` enable the DOM and validity checks. Everything else is
standard library.

---

## Block a bad push automatically

```bash
git config core.hooksPath tools/hooks
```

Once set, `tools/hooks/pre-push` runs the static checks on every `git push` and refuses
the push if any FAIL. Git hooks are not committed, which is why this points git at a
tracked directory instead — it survives re-cloning.

To push anyway: `git push --no-verify`.

`.github/workflows/verify.yml` runs the same script (plus the live browser checks) on
every push and pull request, so a problem is still caught if the hook is bypassed or a
file is edited directly on github.com. Screenshots are uploaded as a build artifact.

---

## Editing notes

- **Adding a news item:** copy an existing `.highlight__item` inside a
  `.highlight__grid-3x2` on `index.html`. It needs an `<img>`, an `<h3>`, and a
  `<template class="modal-template">`. `main.js` clones that template into the shared
  modal, so nothing else needs wiring. Keep `role="button"`, `tabindex="0"` and the
  `aria-label` or the card stops being keyboard-reachable. Author slides of six; on
  phones `main.js` splits each one into slides of three automatically.
- **Card thumbnails are 16:9.** News thumbnails are cropped to fill that frame; if the
  image is mostly text or logos and the crop would cut words off, give the card's
  `<img>` `class="highlight__thumb--contain"` to fit it whole instead. Publication
  thumbnails are always fitted whole. The modals show every image uncropped.
- **Adding a publication:** in `publications/index.html`, the "All" tab card and the
  "Traditional" list entry are separate; add both. Every card in `#all` must contain
  exactly one `.publications__modal` or the index pairing breaks (`tools/check.py` will
  tell you).
- **Adding a page:** create `newpage/index.html`, copy the `<head>`, icon sprite, header
  and footer from an existing sub-page, give it its own title/description/canonical, and
  add the nav entry to **every** page's header and footer. `check.py` will flag a
  duplicated canonical or a missing `<h1>`.
- **Images:** save as WebP, at most 1600 px on the long edge — nothing on the page is
  shown wider than about 720 px, so that is already sharp on high-density screens.
  Posters opened full-screen are JPEG at 4000 px. Add `loading="lazy"`,
  `decoding="async"` and the file's real `width`/`height`; the dimensions prevent
  layout shift, and CSS still controls the displayed size. `dwt_uog.jpg` stays JPEG
  because it is the social-sharing image, and link previews do not all accept WebP.
- **Icons** are inline SVG, drawn from the sprite at the top of `<body>`:
  `<svg class="icon" aria-hidden="true"><use href="#i-NAME"></use></svg>`. They size
  to the surrounding `font-size` and take the text colour. To add one, copy the `<path>`
  from the Unicons "line" SVG set into a new `<symbol id="i-NAME" viewBox="0 0 24 24">`.
  **The sprite is duplicated on every page** — `<use>` cannot reach into another
  document — so a new symbol has to be added to all five, which is what the split
  script does automatically.
- **External links:** always `target="_blank" rel="noopener noreferrer"`.
- **Theme:** `body.dark-theme` overrides the custom properties in `:root`. An inline
  script in `<head>` sets `html.dark-theme-preload` before first paint so returning
  dark-theme visitors never see a flash of light.
- Run `python tools/check.py` when you are done.

---

## Going live on thomaslab.eu

Nothing below has been done — the site is still built and verified only.

**1. Point the domain at GitHub Pages.** At the registrar for `thomaslab.eu`, create four
`A` records for the apex and four `AAAA` records, all named `@`:

```text
A     185.199.108.153      AAAA  2606:50c0:8000::153
A     185.199.109.153      AAAA  2606:50c0:8001::153
A     185.199.110.153      AAAA  2606:50c0:8002::153
A     185.199.111.153      AAAA  2606:50c0:8003::153
CNAME www  ->  deant94.github.io
```

Confirm these against
<https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site>
before relying on them — GitHub has changed the IPs before.

**2. Merge and switch the domain.** Merge this branch to `main`, then replace the
contents of `CNAME` with `thomaslab.eu` and push. One repo serves exactly one custom
domain, so this is also the moment `deanthomas.eu` stops being served from here.

**3. Wait for the certificate.** In Settings → Pages, wait until the domain verifies,
then tick **Enforce HTTPS**. Provisioning the certificate usually takes a few minutes
and can take up to 24 hours.

**4. Forward the old domain.** Set `deanthomas.eu` to redirect to `https://thomaslab.eu`
using the registrar's URL-forwarding feature (a 301, so search engines carry the ranking
across). GitHub Pages cannot do this for you from this repo — it only serves the one
domain in `CNAME`.

**5. Update anything that points at the old URLs.** Google Scholar, ORCID, LinkedIn,
email signatures, and any QR codes in printed posters.
