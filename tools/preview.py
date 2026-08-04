#!/usr/bin/env python3
"""
Serve the site locally exactly the way GitHub Pages does, and open it in a browser.

    python tools/preview.py            # http://127.0.0.1:8000
    python tools/preview.py 8080       # a different port
    python tools/preview.py --no-open  # do not launch a browser

Why not just double-click index.html? Opening the file directly uses the file://
protocol, where a root-relative path like "/assets/favicon/favicon-32x32.png" resolves
against the drive root (C:/assets/...) instead of the site root. The favicons, the web
manifest and anything else referenced from "/" silently 404, so the page you inspect is
not the page visitors get. Serving over HTTP from the repository root reproduces the
real thing.

Press Ctrl+C to stop.
"""

import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    """Serve from the repo root and mimic Pages' 404 page."""

    def send_error(self, code, message=None, explain=None):
        if code == 404 and os.path.exists(os.path.join(REPO, '404.html')):
            try:
                body = open(os.path.join(REPO, '404.html'), 'rb').read()
            except OSError:
                return super().send_error(code, message, explain)
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
            return
        return super().send_error(code, message, explain)


def main():
    args = [a for a in sys.argv[1:] if a != '--no-open']
    port = int(args[0]) if args else 8000
    open_browser = '--no-open' not in sys.argv

    handler = functools.partial(Handler, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
    except OSError as exc:
        print(f'Could not bind port {port}: {exc}')
        print(f'Try a different one, e.g.  python tools/preview.py {port + 1}')
        return 1

    url = f'http://127.0.0.1:{port}/'
    print(f'Serving {REPO}\n    {url}\n    404 page: {url}does-not-exist\nCtrl+C to stop.')
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
