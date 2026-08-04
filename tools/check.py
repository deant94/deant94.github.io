#!/usr/bin/env python3
"""
Pre-push verification for deanthomas.eu.

Run from the repository root:

    python tools/check.py              # static checks only (fast, no dependencies)
    python tools/check.py --live       # also load the site in a real browser
    python tools/check.py --live --shots   # ...and save screenshots for visual review

Exit code is 0 when everything passes and 1 when any check FAILS, so this can gate a
git hook or a CI job. WARNings never fail the run — they are things worth a look.

The static checks need nothing but Python. The --live checks additionally need
Playwright + Chromium; if those are missing the script says so and skips them rather
than failing.

    python -m pip install playwright
    python -m playwright install chromium
"""

import argparse
import functools
import http.server
import json
import os
import re
import socket
import socketserver
import sys
import threading

# ── plumbing ──────────────────────────────────────────────────────────────────

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = ['index.html', '404.html']
TEXT_SOURCES = PAGES + [
    'site.webmanifest', 'assets/css/styles.css', 'assets/js/main.js',
]
# Vendored third-party files are not ours to lint.
VENDOR = ('assets/css/swiper-bundle.min.css', 'assets/js/swiper-bundle.min.js')

results = []


def record(status, name, detail=''):
    results.append((status, name, detail))


def read(path):
    with open(os.path.join(REPO, path), encoding='utf-8', errors='replace') as fh:
        return fh.read()


def strip_comments(html):
    """Remove HTML comments so commented-out markup is not linted as if it were live."""
    return re.sub(r'<!--.*?-->', '', html, flags=re.S)


def strip_scripts(html):
    """Remove <script> bodies — raw-text elements have different escaping rules."""
    return re.sub(r'<script\b.*?</script>', '', html, flags=re.S)


def all_repo_files():
    """Files that are actually part of the published site.

    Skips dot-directories (.git, .github, .preview-shots, .vscode) and tools/, none of
    which are site content — .preview-shots in particular holds screenshots this script
    generates itself, and it is gitignored.
    """
    out = []
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs
                   if not d.startswith('.') and d not in ('__pycache__', 'tools')]
        for fn in files:
            rel = os.path.relpath(os.path.join(root, fn), REPO).replace(os.sep, '/')
            out.append(rel)
    return out


# ── static checks ─────────────────────────────────────────────────────────────

def check_references_resolve():
    """Every local src/href must exist, with EXACTLY the casing used in the markup.

    This is the highest-value check here. Windows filesystems are case-insensitive but
    GitHub Pages is case-sensitive, so `AP1.PNG` vs `ap1.png` loads perfectly on this
    machine and 404s for every visitor. It cannot be caught by looking at the page
    locally.
    """
    broken, mismatched, checked = [], [], 0

    def verify(path, where, raw):
        nonlocal checked
        checked += 1
        full = os.path.join(REPO, path.replace('/', os.sep))
        if not os.path.exists(full):
            broken.append(f'{where}: {raw}')
            return
        cur = REPO
        for part in path.split('/'):
            entries = os.listdir(cur)
            if part not in entries:
                actual = [e for e in entries if e.lower() == part.lower()]
                mismatched.append(f'{where}: {raw} -> on disk as {actual}')
                return
            cur = os.path.join(cur, part)

    for page in PAGES:
        html = read(page)
        for raw in set(re.findall(r'(?:src|href)="([^"]+)"', html)):
            if re.match(r'(?:https?:|mailto:|data:|tel:|//|#)', raw) or raw in ('', '/'):
                continue
            verify(raw.lstrip('/').split('?')[0].split('#')[0], page, raw)

    css = read('assets/css/styles.css')
    for raw in re.findall(r'url\(["\']?([^"\')]+)', css):
        if re.match(r'(?:https?:|data:)', raw):
            continue
        rel = os.path.normpath(os.path.join('assets/css', raw)).replace(os.sep, '/')
        verify(rel, 'styles.css', raw)

    if broken or mismatched:
        record('FAIL', 'local references resolve',
               f'{len(broken)} missing, {len(mismatched)} case-mismatched\n      '
               + '\n      '.join(broken + mismatched))
    else:
        record('PASS', 'local references resolve', f'{checked} checked')


def check_manifest():
    try:
        man = json.loads(read('site.webmanifest'))
    except Exception as exc:
        record('FAIL', 'site.webmanifest parses', str(exc))
        return
    problems = []
    for field in ('name', 'short_name', 'start_url', 'icons'):
        if not man.get(field):
            problems.append(f'{field} is empty or missing')
    for icon in man.get('icons', []):
        src = icon.get('src', '')
        if not os.path.exists(os.path.join(REPO, src.lstrip('/').replace('/', os.sep))):
            problems.append(f'icon 404: {src}')
    record('FAIL' if problems else 'PASS', 'site.webmanifest',
           '; '.join(problems) or f"{man.get('name')!r}, {len(man.get('icons', []))} icons")


def check_external_links():
    """target="_blank" hands the opened tab a window.opener handle back to this page."""
    offenders = []
    for page in PAGES:
        for tag in re.findall(r'<a\b[^>]*>', strip_comments(read(page))):
            if re.search(r'target=[\'"]_blank[\'"]', tag) and not re.search(r'\brel=', tag):
                offenders.append(f'{page}: {tag[:100]}')
    record('FAIL' if offenders else 'PASS', 'target=_blank carries rel',
           f'{len(offenders)} without rel\n      ' + '\n      '.join(offenders[:5])
           if offenders else 'all external links have rel')


def check_empty_hrefs():
    """href="" resolves to the current document, so the link silently reloads the page."""
    hits = [page for page in PAGES if 'href=""' in strip_comments(read(page))]
    record('FAIL' if hits else 'PASS', 'no empty href=""',
           f'found in {hits}' if hits else 'none')


def check_alt_and_titles():
    missing_alt, missing_title = [], []
    for page in PAGES:
        html = strip_comments(read(page))
        for tag in re.findall(r'<img\b[^>]*>', html):
            if not re.search(r'\balt=', tag):
                missing_alt.append(f'{page}: {tag[:90]}')
        for tag in re.findall(r'<iframe\b[^>]*>', html):
            if not re.search(r'\btitle=', tag):
                missing_title.append(f'{page}: {tag[:90]}')
    problems = missing_alt + missing_title
    record('FAIL' if problems else 'PASS', 'images have alt, iframes have title',
           f'{len(missing_alt)} img without alt, {len(missing_title)} iframe without title\n      '
           + '\n      '.join(problems[:5]) if problems else 'all present')


def check_duplicate_ids():
    for page in PAGES:
        ids = re.findall(r'\bid="([^"]+)"', strip_comments(read(page)))
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            record('FAIL', f'{page}: unique ids', f'duplicated: {dupes}')
            return
    record('PASS', 'unique ids', 'no duplicates')


def check_single_h1():
    for page in PAGES:
        n = len(re.findall(r'<h1\b', strip_comments(read(page))))
        if n != 1:
            record('WARN' if n == 0 else 'FAIL', f'{page}: exactly one <h1>', f'found {n}')
            return
    record('PASS', 'exactly one <h1> per page')


def check_nav_active_state():
    """Regression guard: every nav link once shipped class="nav__link active-link",
    so the whole menu rendered highlighted until the first scroll event."""
    html = read('index.html')
    active = re.findall(r'<a href="#[^"]*" class="nav__link active-link"', html)
    record('FAIL' if len(active) > 1 else 'PASS', 'at most one nav link starts active',
           f'{len(active)} nav links hardcode active-link' if len(active) > 1
           else f'{len(active)} (scroll handler drives the rest)')


def check_modal_pairing():
    """Regression guard for the real bug this repo had: the publications modal triggers
    were selected with '.publications__content .publications__content', which also
    matched the Traditional list. Those rows have no modal, so clicking one indexed past
    the end of the modal list and threw a TypeError. main.js pairs the two lists BY
    INDEX, so their counts must match exactly."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        record('SKIP', 'publications modal pairing', 'needs beautifulsoup4')
        return
    soup = BeautifulSoup(read('index.html'), 'html.parser')
    js = read('assets/js/main.js')
    trig_sel = re.search(r"modalBtns\s*=\s*document\.querySelectorAll\('([^']+)'\)", js)
    view_sel = re.search(r"modalViews\s*=\s*document\.querySelectorAll\('([^']+)'\)", js)
    if not (trig_sel and view_sel):
        record('WARN', 'publications modal pairing', 'could not read selectors from main.js')
        return
    triggers = soup.select(trig_sel.group(1))
    views = soup.select(view_sel.group(1))
    ok = len(triggers) == len(views)
    aligned = ok and all(v in t.select('.publications__modal') for t, v in zip(triggers, views))
    record('PASS' if (ok and aligned) else 'FAIL', 'publications modal pairing',
           f'{len(triggers)} triggers vs {len(views)} modals, index-aligned={aligned}')


def check_sections_have_nav_links():
    """main.js maps every section[id] to a nav link; a section without one is skipped."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        record('SKIP', 'sections have nav links', 'needs beautifulsoup4')
        return
    soup = BeautifulSoup(read('index.html'), 'html.parser')
    missing = [
        section['id'] for section in soup.select('section[id]')
        if not soup.select('.nav__menu a[href="#%s"]' % section['id'])
    ]
    record('WARN' if missing else 'PASS', 'sections have a nav link',
           f'no nav link for: {missing}' if missing else 'all sections linked')


def check_unreferenced_assets():
    """Guards against unused images piling up again (71 MB had accumulated).
    Raw-text match, so a filename inside an HTML comment counts as referenced."""
    blob = ''.join(read(f) for f in TEXT_SOURCES if os.path.exists(os.path.join(REPO, f)))
    # Allowlist actual media extensions rather than denylisting config files, so adding
    # a new dotfile or workflow never shows up here as a stray asset.
    ASSET_EXT = ('.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.bmp', '.svg',
                 '.ico', '.mp4', '.webm', '.mov', '.pdf', '.woff', '.woff2', '.ttf')
    unref = []
    for rel in all_repo_files():
        if not rel.lower().endswith(ASSET_EXT):
            continue
        # assets/favicon/* is wired up through <link> tags and the manifest
        if rel.startswith('assets/favicon/'):
            continue
        if os.path.basename(rel) not in blob:
            unref.append(rel)
    total = sum(os.path.getsize(os.path.join(REPO, p)) for p in unref)
    record('WARN' if unref else 'PASS', 'no unreferenced assets',
           f'{len(unref)} files, {total / 1048576:.1f} MB unused\n      '
           + '\n      '.join(unref[:10]) if unref else 'every asset is referenced')


def check_large_assets(limit_mb=2.0):
    big = []
    for rel in all_repo_files():
        if rel.startswith(('tools/', '.github/')):
            continue
        size = os.path.getsize(os.path.join(REPO, rel))
        if size > limit_mb * 1048576:
            big.append((rel, size))
    big.sort(key=lambda x: -x[1])
    record('WARN' if big else 'PASS', f'no asset over {limit_mb:g} MB',
           '\n      '.join(f'{s / 1048576:6.1f} MB  {p}' for p, s in big[:10])
           if big else 'all assets are reasonably sized')


def check_lazy_loading():
    eager = []
    for page in PAGES:
        html = strip_comments(read(page))
        for tag in re.findall(r'<img\b[^>]*>', html) + re.findall(r'<iframe\b[^>]*>', html):
            if 'loading=' not in tag and 'fetchpriority' not in tag:
                eager.append(f'{page}: {tag[:80]}')
    record('WARN' if eager else 'PASS', 'images/iframes lazy-load',
           f'{len(eager)} eager\n      ' + '\n      '.join(eager[:5])
           if eager else 'all deferred (or explicitly prioritised)')


def check_seo_head():
    html = read('index.html')
    need = {
        'meta description': r'<meta\s+name="description"',
        'canonical': r'<link\s+rel="canonical"',
        'og:title': r'property="og:title"',
        'og:image': r'property="og:image"',
        'twitter:card': r'name="twitter:card"',
        'theme-color': r'name="theme-color"',
        'JSON-LD': r'application/ld\+json',
    }
    missing = [k for k, pat in need.items() if not re.search(pat, html)]
    record('WARN' if missing else 'PASS', 'SEO / social metadata',
           f'missing: {missing}' if missing else f'{len(need)} present')
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    if m:
        try:
            json.loads(m.group(1))
            record('PASS', 'JSON-LD is valid JSON')
        except Exception as exc:
            record('FAIL', 'JSON-LD is valid JSON', str(exc))


def check_charset_first():
    """charset must appear in the first 1024 bytes, before any script, or the parser
    may have to restart."""
    for page in PAGES:
        # Strip comments first: a comment merely mentioning the word "charset" must not
        # be mistaken for the declaration itself.
        html = strip_comments(read(page))
        meta = re.search(r'<meta[^>]*\bcharset\s*=', html, re.I)
        script = re.search(r'<script\b', html, re.I)
        if not meta:
            record('FAIL', 'charset declared before any script',
                   f'{page}: no <meta charset> at all')
            return
        if meta.start() > 1024:
            record('FAIL', 'charset declared before any script',
                   f'{page}: <meta charset> at byte {meta.start()}, must be within the first 1024')
            return
        if script and script.start() < meta.start():
            record('FAIL', 'charset declared before any script',
                   f'{page}: <script> at byte {script.start()} precedes <meta charset> at {meta.start()}')
            return
    record('PASS', 'charset declared before any script')


def check_bare_ampersands():
    """A bare & in markup is invalid; inside <script> it must stay bare."""
    bad = []
    for page in PAGES:
        markup = strip_scripts(read(page))
        for m in re.finditer(r'&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)', markup):
            bad.append(f'{page}: ...{markup[max(0, m.start() - 30):m.start() + 12]}...')
    record('WARN' if bad else 'PASS', 'ampersands escaped in markup',
           f'{len(bad)} bare &\n      ' + '\n      '.join(bad[:5]) if bad else 'all escaped')


def check_html_validity():
    try:
        import html5lib
    except ImportError:
        record('SKIP', 'HTML5 validity', 'needs html5lib')
        return
    for page in PAGES:
        parser = html5lib.HTMLParser(strict=True)
        try:
            parser.parse(read(page))
            errs = []
        except Exception:
            errs = parser.errors
        # '--' inside a comment is allowed by HTML5; html5lib still flags it.
        errs = [e for e in errs if e[1] != 'unexpected-char-in-comment']
        if errs:
            record('FAIL', f'{page}: HTML5 validity',
                   f'{len(errs)} errors: {errs[:3]}')
            return
    record('PASS', 'HTML5 validity', 'no parse errors')


def check_ds_store_untracked():
    import subprocess
    try:
        out = subprocess.run(['git', 'ls-files'], cwd=REPO, capture_output=True,
                             text=True, timeout=30).stdout
    except Exception:
        record('SKIP', '.DS_Store not tracked', 'git unavailable')
        return
    tracked = [ln for ln in out.splitlines() if ln.strip().endswith('.DS_Store')]
    record('FAIL' if tracked else 'PASS', '.DS_Store not tracked',
           f'tracked: {tracked}' if tracked else 'clean')


def check_css_sanity():
    css = read('assets/css/styles.css')
    problems = []
    if css.count('{') != css.count('}'):
        problems.append(f"unbalanced braces: {css.count('{')} open, {css.count('}')} close")
    # a selector list must end at '{', never at a comment/at-rule/close-brace
    for m in re.finditer(r',\s*\n\s*(?:\n|/\*|@|\})', css):
        problems.append(f'dangling selector near line {css[:m.start()].count(chr(10)) + 1}')
    used = set(re.findall(r'var\(\s*(--[\w-]+)', css))
    declared = set(re.findall(r'^\s*(--[\w-]+)\s*:', css, re.M))
    undefined = sorted(used - declared)
    if undefined:
        problems.append(f'var() never declared: {undefined}')
    record('FAIL' if problems else 'PASS', 'CSS sanity', '; '.join(problems) or 'balanced, no undefined vars')


# ── live browser checks ───────────────────────────────────────────────────────

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(port):
    handler = functools.partial(QuietHandler, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def find_chromium():
    """Playwright's default headless build may be absent while full Chromium is present."""
    base = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ms-playwright')
    if not os.path.isdir(base):
        return None
    for entry in sorted(os.listdir(base), reverse=True):
        if entry.startswith('chromium-'):
            for sub in ('chrome-win64', 'chrome-win', 'chrome-linux'):
                for exe in ('chrome.exe', 'chrome'):
                    cand = os.path.join(base, entry, sub, exe)
                    if os.path.exists(cand):
                        return cand
    return None


def run_live(shots_dir=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        record('SKIP', 'live browser checks',
               'pip install playwright && python -m playwright install chromium')
        return

    port = free_port()
    httpd = serve(port)
    base = f'http://127.0.0.1:{port}/'
    try:
        with sync_playwright() as pw:
            launch = {}
            exe = find_chromium()
            if exe:
                launch['executable_path'] = exe
            try:
                browser = pw.chromium.launch(**launch)
            except Exception as exc:
                record('SKIP', 'live browser checks', f'could not launch Chromium: {exc}')
                return

            errors, failed = [], []
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('requestfailed',
                    lambda r: failed.append(r.url) if r.url.startswith(base) else None)

            resp = page.goto(base, wait_until='load')
            page.wait_for_timeout(2500)
            record('PASS' if resp.status == 200 else 'FAIL', 'page returns 200',
                   f'HTTP {resp.status}')

            # scroll the whole page so lazy images are actually requested
            page.evaluate("""async () => {
                for (let y = 0; y < document.body.scrollHeight; y += 700) {
                    window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
                }
                window.scrollTo(0, 0);
            }""")
            page.wait_for_timeout(2000)

            record('FAIL' if errors else 'PASS', 'no uncaught JS errors',
                   '; '.join(errors[:3]) if errors else 'clean')
            record('FAIL' if failed else 'PASS', 'no failed same-origin requests',
                   '; '.join(u.replace(base, '/') for u in failed[:5]) if failed else 'none')

            broken = page.evaluate("""Array.from(document.images)
                .filter(i => i.complete && i.naturalWidth === 0)
                .map(i => i.getAttribute('src'))""")
            total = page.evaluate('document.images.length')
            record('FAIL' if broken else 'PASS', 'all images decode',
                   f'{len(broken)} broken: {broken[:5]}' if broken else f'{total}/{total} rendered')

            # horizontal scrollbar: check real scrollability, not scrollWidth, because
            # overflow:clip suppresses the scrollbar without changing scrollWidth
            scrolls = []
            for w in range(320, 1501, 20):
                page.set_viewport_size({'width': w, 'height': 900})
                page.wait_for_timeout(70)
                page.evaluate('window.scrollTo(9999, 0)')
                page.wait_for_timeout(40)
                if page.evaluate('window.scrollX'):
                    scrolls.append(w)
                page.evaluate('window.scrollTo(0, 0)')
            record('FAIL' if scrolls else 'PASS', 'no horizontal scrollbar',
                   f'scrolls at: {scrolls}' if scrolls else 'clean 320-1500px')

            page.set_viewport_size({'width': 1280, 'height': 900})
            page.wait_for_timeout(300)

            carousels = page.evaluate("""Array.from(document.querySelectorAll('.highlight__container'))
                .map(el => ({section: el.closest('section').id, ready: !!el.swiper}))""")
            dead = [c['section'] for c in carousels if not c['ready']]
            record('FAIL' if dead else 'PASS', 'carousels initialise',
                   f'not initialised: {dead}' if dead else
                   f"{len(carousels)} ready ({', '.join(c['section'] for c in carousels)})")

            # a news card must open the shared modal and Escape must close it
            page.eval_on_selector('.highlight__item', 'el => el.focus()')
            page.keyboard.press('Enter')
            page.wait_for_timeout(600)
            opened = page.evaluate(
                "document.getElementById('master-highlight-modal').classList.contains('active-modal')")
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)
            closed = not page.evaluate(
                "document.getElementById('master-highlight-modal').classList.contains('active-modal')")
            cleared = page.evaluate(
                "document.getElementById('master-modal-content').innerHTML.trim() === ''")
            ok = opened and closed and cleared
            record('PASS' if ok else 'FAIL', 'news modal opens by keyboard and closes',
                   f'opened={opened} closed={closed} cleared={cleared}')

            # every Traditional-tab row must be clickable without throwing
            before = len(errors)
            page.click('.publications__subset[data-target="#traditional"]')
            page.wait_for_timeout(400)
            rows = page.query_selector_all('#traditional .publications__content')
            for row in rows[:3]:
                row.click()
                page.wait_for_timeout(150)
            record('FAIL' if len(errors) > before else 'PASS',
                   'Traditional publication rows do not throw',
                   f'{len(errors) - before} new errors from {len(rows)} rows'
                   if len(errors) > before else f'{len(rows)} rows clean')

            if shots_dir:
                os.makedirs(shots_dir, exist_ok=True)
                page.close()
                names = []
                for theme in ('light', 'dark'):
                    for w, h, tag in ((390, 844, 'mobile'), (768, 1024, 'tablet'), (1280, 900, 'desktop')):
                        p = browser.new_page(viewport={'width': w, 'height': h}, color_scheme=theme)
                        p.goto(base, wait_until='load')
                        p.wait_for_timeout(2400)
                        name = f'{theme}-{tag}.png'
                        p.screenshot(path=os.path.join(shots_dir, name), full_page=True)
                        names.append(name)
                        p.close()
                record('PASS', 'screenshots saved',
                       f'{len(names)} in {os.path.relpath(shots_dir, REPO)}/')
            browser.close()
    finally:
        httpd.shutdown()


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description='Verify the site before pushing.')
    ap.add_argument('--live', action='store_true', help='also load the site in Chromium')
    ap.add_argument('--shots', action='store_true', help='save screenshots (implies --live)')
    args = ap.parse_args()
    if args.shots:
        args.live = True

    os.chdir(REPO)

    print('\n\033[1mStatic checks\033[0m')
    for fn in (check_charset_first, check_references_resolve, check_manifest,
               check_external_links, check_empty_hrefs, check_alt_and_titles,
               check_duplicate_ids, check_single_h1, check_nav_active_state,
               check_modal_pairing, check_sections_have_nav_links,
               check_html_validity, check_bare_ampersands, check_css_sanity,
               check_seo_head, check_lazy_loading, check_unreferenced_assets,
               check_large_assets, check_ds_store_untracked):
        try:
            fn()
        except Exception as exc:  # a broken check must not masquerade as a passing site
            record('FAIL', fn.__name__, f'check itself errored: {exc!r}')

    if args.live:
        print()  # separator; run_live prints nothing itself
        try:
            run_live(os.path.join(REPO, '.preview-shots') if args.shots else None)
        except Exception as exc:
            record('FAIL', 'live browser checks', f'errored: {exc!r}')

    colour = {'PASS': '\033[32m', 'FAIL': '\033[31m', 'WARN': '\033[33m', 'SKIP': '\033[90m'}
    counts = {}
    print()
    for status, name, detail in results:
        counts[status] = counts.get(status, 0) + 1
        print(f'  {colour[status]}{status:4}\033[0m  {name}' + (f'\n        {detail}' if detail else ''))

    print('\n  ' + '  '.join(f'{colour[k]}{k} {v}\033[0m' for k, v in sorted(counts.items())))
    failed = counts.get('FAIL', 0)
    print(f"\n\033[1m{'FAILED — do not push' if failed else 'OK to push'}\033[0m\n")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
