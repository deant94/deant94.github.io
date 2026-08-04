# deanthomas.eu

Personal academic site for Dr Dean Thomas FHEA — Research Fellow in Digital Chemistry,
University of Glasgow. Published with GitHub Pages from `main` at
**<https://deanthomas.eu>** (domain set by `CNAME`).

No build step, no dependencies, no framework. Edit the files and push.

```
index.html               the whole site — one page, all content inline
404.html                 error page, styled from the same stylesheet
assets/css/styles.css    all styling (hand-written)
assets/js/main.js        nav, tabs, modals, carousels, theme, scroll handlers
assets/css|js/swiper-*   vendored Swiper 6.5.8 — do not edit
assets/img/              images
assets/favicon/          favicons referenced by <link> and site.webmanifest
site.webmanifest         PWA manifest
tools/                   local preview + pre-push verification (not part of the site)
```

---

## Preview it before pushing

```bash
python tools/preview.py
```

Serves the site at <http://127.0.0.1:8000> and opens a browser.

**Do not check the site by double-clicking `index.html`.** That opens it over `file://`,
where a root-relative path like `/assets/favicon/favicon-32x32.png` resolves against the
drive root (`C:/assets/...`) rather than the site root. The favicons and the manifest
silently 404, so what you inspect is not what visitors get. `tools/preview.py` serves
from the repository root, which is what GitHub Pages does, and it also serves `404.html`
for unknown paths so you can check that too.

---

## Verify it before pushing

```bash
python tools/check.py                  # fast, needs only Python
python tools/check.py --live           # also loads the site in a real browser
python tools/check.py --live --shots   # ...and writes screenshots to .preview-shots/
```

Exit code is 0 when everything passes, 1 if anything **FAILS**. `WARN` never blocks — it
flags things worth a look.

### What it catches

| Check | Why it matters |
| --- | --- |
| **local references resolve** | Every `src`/`href` exists **with matching case**. Windows is case-insensitive, GitHub Pages is not — so `CAS.jpg` referenced as `cas.jpg` looks perfect locally and 404s for every visitor. This class of bug is invisible in a local browser. |
| publications modal pairing | `main.js` pairs modal triggers to modals **by index**. If the selectors drift out of sync, clicking a row throws a `TypeError`. This actually happened: the trigger selector matched the Traditional list too, whose rows have no modal. |
| at most one nav link starts active | Every nav link once hardcoded `active-link`, so the whole menu rendered highlighted until the first scroll. |
| `target=_blank` carries `rel` | Without `rel`, the opened tab gets a `window.opener` handle back to this page. |
| no empty `href=""` | Resolves to the current document, so the link silently reloads the page. |
| charset declared before any script | Otherwise the parser may have to restart. |
| site.webmanifest | Every field populated and every icon path actually resolving. |
| alt / iframe titles, unique ids, one `<h1>` | Screen-reader and validity basics. |
| HTML5 validity, escaped ampersands | Real parse errors, not pedantry. |
| CSS sanity | Balanced braces, no dangling selector fragments, no `var()` that is never declared. |
| unreferenced assets *(warn)* | Guards against unused images piling up again — 71 MB had accumulated. |
| assets over 2 MB *(warn)* | Oversized images to revisit. |
| `.DS_Store` not tracked | |

With `--live` it additionally serves the site, loads it in Chromium and asserts: HTTP 200,
**zero uncaught JS errors**, no failed same-origin requests, every image decodes, **no
horizontal scrollbar from 320–1500 px**, both carousels initialise, the news modal opens
by keyboard and closes on Escape, and no Traditional-tab row throws.

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
  `.highlight__grid-3x3`. It needs an `<img>`, an `<h3>`, and a
  `<template class="modal-template">`. `main.js` clones that template into the shared
  modal, so nothing else needs wiring. Keep `role="button"`, `tabindex="0"` and the
  `aria-label` or the card stops being keyboard-reachable.
- **Adding a publication:** the "All" tab card and the "Traditional" list entry are
  separate; add both. Every card in `#all` must contain exactly one
  `.publications__modal` or the index pairing breaks (`tools/check.py` will tell you).
- **Images:** add `loading="lazy"`, `decoding="async"` and real `width`/`height`.
  The dimensions prevent layout shift; CSS still controls the displayed size.
- **External links:** always `target="_blank" rel="noopener noreferrer"`.
- **Theme:** `body.dark-theme` overrides the custom properties in `:root`. An inline
  script in `<head>` sets `html.dark-theme-preload` before first paint so returning
  dark-theme visitors never see a flash of light.
- Run `python tools/check.py` when you are done.
