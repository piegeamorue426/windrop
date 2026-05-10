"""WSGI application for Windrop giveaway platform.

Compatible with PythonAnywhere free tier and any WSGI server.
No external dependencies required - uses only Python stdlib.
"""

import gzip
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote

# Ensure the project directory is in the path
PROJECT_DIR = Path(__file__).parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

import database
import routes

STATIC_DIR = PROJECT_DIR / "static"

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2"}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"}

# Initialize database on module load
database.init_db()


def get_cors_headers():
    """Return CORS headers as a list of tuples."""
    return [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
    ]


def get_security_headers():
    """Return security headers as a list of tuples."""
    return [
        ("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"),
        ("Strict-Transport-Security", "max-age=31536000; includeSubDomains"),
        ("X-Frame-Options", "DENY"),
        ("X-Content-Type-Options", "nosniff"),
        ("X-XSS-Protection", "1; mode=block"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ]


def serve_static_file(file_path):
    """Serve a static file. Returns (status, headers, body) or None if not found."""
    if not file_path.exists() or not file_path.is_file():
        return None

    # Security: path traversal protection
    try:
        file_path.resolve().relative_to(STATIC_DIR.resolve())
    except ValueError:
        return None

    ext = file_path.suffix.lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")

    try:
        if ext in BINARY_EXTENSIONS:
            with open(file_path, "rb") as f:
                content = f.read()
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().encode("utf-8")

        headers = [("Content-Type", content_type)] + get_cors_headers() + get_security_headers()
        headers.append(("Content-Length", str(len(content))))

        # Cache-Control based on file type
        if ext in (".css", ".js"):
            headers.append(("Cache-Control", "public, max-age=86400"))
        elif ext in IMAGE_EXTENSIONS:
            headers.append(("Cache-Control", "public, max-age=604800"))

        # ETag based on file modification time
        try:
            etag_value = str(int(os.path.getmtime(str(file_path))))
            headers.append(("ETag", etag_value))
        except OSError:
            pass

        return ("200 OK", headers, content)
    except (IOError, OSError):
        return None


def parse_request_body(environ):
    """Read and parse JSON request body from WSGI environ."""
    content_length = int(environ.get("CONTENT_LENGTH") or 0)
    if content_length == 0:
        return None, None

    try:
        body_bytes = environ["wsgi.input"].read(content_length)
        content_type = environ.get("CONTENT_TYPE", "")

        # If multipart, return raw bytes (don't parse as JSON)
        if "multipart/form-data" in content_type:
            return None, body_bytes

        return json.loads(body_bytes.decode("utf-8")), body_bytes
    except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
        return None, None


def get_headers_from_environ(environ):
    """Extract HTTP headers from WSGI environ dict."""
    headers = {}
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            # Convert HTTP_X_FORWARDED_FOR -> X-Forwarded-For
            header_name = key[5:].replace("_", "-").title()
            headers[header_name] = value
    # Content-Type and Content-Length are special in WSGI
    if "CONTENT_TYPE" in environ:
        headers["Content-Type"] = environ["CONTENT_TYPE"]
    if "CONTENT_LENGTH" in environ:
        headers["Content-Length"] = environ["CONTENT_LENGTH"]
    # CRITICAL: Pass REMOTE_ADDR for IP detection on PythonAnywhere
    if "REMOTE_ADDR" in environ:
        headers["Remote-Addr"] = environ["REMOTE_ADDR"]
    return headers


def application(environ, start_response):
    """WSGI application callable."""
    method = environ.get("REQUEST_METHOD", "GET")
    path = unquote(environ.get("PATH_INFO", "/"))

    # Handle CORS preflight
    if method == "OPTIONS":
        headers = get_cors_headers()
        headers.append(("Content-Length", "0"))
        start_response("204 No Content", headers)
        return [b""]

    # robots.txt
    if path == "/robots.txt":
        robots_content = (
            "User-agent: *\n"
            "Allow: /\n"
            "Disallow: /api/admin/\n"
            "Sitemap: https://windrop.pythonanywhere.com/sitemap.xml\n"
        ).encode("utf-8")
        headers = [
            ("Content-Type", "text/plain; charset=utf-8"),
            ("Content-Length", str(len(robots_content))),
        ] + get_cors_headers() + get_security_headers()
        start_response("200 OK", headers)
        return [robots_content]

    # sitemap.xml
    if path == "/sitemap.xml":
        sitemap_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '  <url><loc>https://windrop.pythonanywhere.com/</loc><priority>1.0</priority></url>\n'
            '  <url><loc>https://windrop.pythonanywhere.com/#/giveaways</loc><priority>0.9</priority></url>\n'
            '  <url><loc>https://windrop.pythonanywhere.com/#/winners</loc><priority>0.7</priority></url>\n'
            '  <url><loc>https://windrop.pythonanywhere.com/#/how-it-works</loc><priority>0.6</priority></url>\n'
            '  <url><loc>https://windrop.pythonanywhere.com/#/faq</loc><priority>0.5</priority></url>\n'
            '  <url><loc>https://windrop.pythonanywhere.com/#/contact</loc><priority>0.4</priority></url>\n'
            '</urlset>\n'
        ).encode("utf-8")
        headers = [
            ("Content-Type", "application/xml; charset=utf-8"),
            ("Content-Length", str(len(sitemap_content))),
        ] + get_cors_headers() + get_security_headers()
        start_response("200 OK", headers)
        return [sitemap_content]

    # Parse path into parts
    parts = [p for p in path.split("/") if p]

    # API routes
    if parts and parts[0] == "api":
        body = None
        raw_body = None
        if method in ("POST", "PUT"):
            body, raw_body = parse_request_body(environ)

        headers = get_headers_from_environ(environ)

        # Add REMOTE_ADDR as X-Real-Ip if not already present
        if "X-Real-Ip" not in headers:
            headers["X-Real-Ip"] = environ.get("REMOTE_ADDR", "")

        try:
            status_code, response_data = routes.route_request(method, parts, body, headers, raw_body=raw_body)
        except Exception as e:
            status_code = 500
            response_data = {"error": "Internal server error"}

        response_body = json.dumps(response_data, ensure_ascii=False).encode("utf-8")
        status_map = {
            200: "200 OK",
            201: "201 Created",
            204: "204 No Content",
            400: "400 Bad Request",
            401: "401 Unauthorized",
            403: "403 Forbidden",
            404: "404 Not Found",
            429: "429 Too Many Requests",
            500: "500 Internal Server Error",
        }
        status_str = status_map.get(status_code, f"{status_code} Response")

        response_headers = [
            ("Content-Type", "application/json; charset=utf-8"),
        ] + get_cors_headers() + get_security_headers()

        # Gzip compression for API responses
        accept_encoding = environ.get("HTTP_ACCEPT_ENCODING", "")
        if "gzip" in accept_encoding and len(response_body) > 256:
            response_body = gzip.compress(response_body)
            response_headers.append(("Content-Encoding", "gzip"))

        response_headers.append(("Content-Length", str(len(response_body))))

        start_response(status_str, response_headers)
        return [response_body]

    # Static file serving
    if parts and parts[0] == "static":
        # /static/css/style.css -> static_dir/css/style.css
        relative_path = "/".join(parts[1:])
        file_path = STATIC_DIR / relative_path
        result = serve_static_file(file_path)
        if result:
            status, headers, body = result
            start_response(status, headers)
            return [body]

    # Try to serve file directly from static dir
    if parts:
        file_path = STATIC_DIR / "/".join(parts)
        result = serve_static_file(file_path)
        if result:
            status, headers, body = result
            start_response(status, headers)
            return [body]

    # SPA fallback: serve index.html for any non-API, non-static path
    index_path = STATIC_DIR / "index.html"
    result = serve_static_file(index_path)
    if result:
        status, headers, body = result
        start_response(status, headers)
        return [body]

    # Fallback if index.html doesn't exist
    fallback_body = b"<html><body><h1>Windrop - Coming Soon</h1></body></html>"
    headers = [
        ("Content-Type", "text/html; charset=utf-8"),
        ("Content-Length", str(len(fallback_body))),
    ] + get_cors_headers() + get_security_headers()
    start_response("200 OK", headers)
    return [fallback_body]
