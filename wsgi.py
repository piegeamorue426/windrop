"""WSGI application for Windrop giveaway platform.

Compatible with PythonAnywhere free tier and any WSGI server.
No external dependencies required - uses only Python stdlib.
"""

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
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"}

# Initialize database on module load
database.init_db()


def get_cors_headers():
    """Return CORS headers as a list of tuples."""
    return [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
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

        headers = [("Content-Type", content_type)] + get_cors_headers()
        headers.append(("Content-Length", str(len(content))))
        return ("200 OK", headers, content)
    except (IOError, OSError):
        return None


def parse_request_body(environ):
    """Read and parse JSON request body from WSGI environ."""
    content_length = int(environ.get("CONTENT_LENGTH") or 0)
    if content_length == 0:
        return None

    try:
        body_bytes = environ["wsgi.input"].read(content_length)
        return json.loads(body_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
        return None


def get_headers_from_environ(environ):
    """Extract HTTP headers from WSGI environ dict."""
    headers = {}
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            # Convert HTTP_CONTENT_TYPE -> Content-Type
            header_name = key[5:].replace("_", "-").title()
            headers[header_name] = value
    # Content-Type and Content-Length are special in WSGI
    if "CONTENT_TYPE" in environ:
        headers["Content-Type"] = environ["CONTENT_TYPE"]
    if "CONTENT_LENGTH" in environ:
        headers["Content-Length"] = environ["CONTENT_LENGTH"]
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

    # Parse path into parts
    parts = [p for p in path.split("/") if p]

    # API routes
    if parts and parts[0] == "api":
        body = None
        if method in ("POST", "PUT"):
            body = parse_request_body(environ)

        headers = get_headers_from_environ(environ)

        try:
            status_code, response_data = routes.route_request(method, parts, body, headers)
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
            500: "500 Internal Server Error",
        }
        status_str = status_map.get(status_code, f"{status_code} Response")

        response_headers = [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(response_body))),
        ] + get_cors_headers()

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
    ] + get_cors_headers()
    start_response("200 OK", headers)
    return [fallback_body]
