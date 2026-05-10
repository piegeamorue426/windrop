"""Main HTTP server for Windrop giveaway platform."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

import database
import routes

PORT = int(os.environ.get("PORT", 3000))
STATIC_DIR = Path(__file__).parent / "static"

MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
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


class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the giveaway platform."""

    def log_message(self, format, *args):
        """Override to use simple print logging."""
        print(f"[{self.log_date_time_string()}] {format % args}")

    def send_cors_headers(self):
        """Send CORS headers for all responses."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def send_json_response(self, status_code, data):
        """Send a JSON response."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.end_headers()
        response = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response.encode("utf-8"))

    def send_error_json(self, status_code, message):
        """Send a JSON error response."""
        self.send_json_response(status_code, {"error": message})

    def serve_static_file(self, file_path):
        """Serve a static file."""
        if not file_path.exists() or not file_path.is_file():
            return False

        # Security check: ensure file is within static directory
        try:
            file_path.resolve().relative_to(STATIC_DIR.resolve())
        except ValueError:
            return False

        ext = file_path.suffix.lower()
        content_type = MIME_TYPES.get(ext, "application/octet-stream")

        try:
            if ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2"):
                with open(file_path, "rb") as f:
                    content = f.read()
            else:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content if isinstance(content, bytes) else content)
            return True
        except (IOError, OSError):
            return False

    def parse_path(self):
        """Parse the URL path into components."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        # Remove leading slash and split
        parts = [p for p in path.split("/") if p]
        return parts, path

    def read_body(self):
        """Read and parse JSON request body. Returns (parsed_json, raw_bytes)."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return None, None
        body = self.rfile.read(content_length)
        content_type = self.headers.get("Content-Type", "")

        # If multipart, don't parse as JSON
        if "multipart/form-data" in content_type:
            return None, body

        try:
            return json.loads(body.decode("utf-8")), body
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, body

    def handle_api_request(self, method):
        """Handle an API request."""
        parts, path = self.parse_path()
        body = None
        raw_body = None
        if method in ("POST", "PUT"):
            body, raw_body = self.read_body()

        # Pass headers as a dict to route_request for auth checks
        headers = {key: self.headers[key] for key in self.headers}

        try:
            status_code, response_data = routes.route_request(method, parts, body, headers, raw_body=raw_body)
            self.send_json_response(status_code, response_data)
        except Exception as e:
            print(f"Error handling {method} {path}: {e}")
            self.send_error_json(500, "Internal server error")

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Handle GET requests."""
        parts, path = self.parse_path()

        # API routes
        if parts and parts[0] == "api":
            self.handle_api_request("GET")
            return

        # Static file serving
        if parts and parts[0] == "static":
            # Remove 'static' from path since STATIC_DIR already points to static/
            relative_path = "/".join(parts[1:])
            file_path = STATIC_DIR / relative_path
            if self.serve_static_file(file_path):
                return

        # Try to serve the file directly from static
        if parts:
            file_path = STATIC_DIR / "/".join(parts)
            if self.serve_static_file(file_path):
                return

        # SPA fallback: serve index.html for any non-API, non-static path
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            self.serve_static_file(index_path)
        else:
            # If no index.html yet, return a simple message
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Windrop - Coming Soon</h1></body></html>")

    def do_POST(self):
        """Handle POST requests."""
        self.handle_api_request("POST")

    def do_PUT(self):
        """Handle PUT requests."""
        self.handle_api_request("PUT")

    def do_DELETE(self):
        """Handle DELETE requests."""
        self.handle_api_request("DELETE")


class ReusableHTTPServer(HTTPServer):
    """HTTP server that allows port reuse."""
    allow_reuse_address = True


def run_server():
    """Start the HTTP server."""
    database.init_db()
    server = ReusableHTTPServer(("0.0.0.0", PORT), RequestHandler)
    print(f"Windrop server running on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()


if __name__ == "__main__":
    run_server()
