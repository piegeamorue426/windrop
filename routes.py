"""API route handlers for Windrop giveaway platform."""

import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
import database

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "windrop-admin-2024")

UPLOAD_DIR = Path(__file__).parent / "static" / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB

# In-memory cache for API responses
_cache = {}
CACHE_TTL = 30  # seconds

# Auto-expire throttle
_last_expire_check = 0


def _cache_get(key):
    """Get cached data if not expired."""
    if key in _cache:
        timestamp, data = _cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _cache_set(key, data):
    """Set cache entry with current timestamp."""
    _cache[key] = (time.time(), data)


def _cache_invalidate():
    """Clear all cached entries."""
    _cache.clear()


def _is_valid_email(email):
    """Check that email is valid: no spaces, one @, non-empty local, domain has dot."""
    if not email or " " in email:
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts
    if not local:
        return False
    if "." not in domain:
        return False
    domain_parts = domain.split(".")
    for part in domain_parts:
        if not part:
            return False
    return True


def check_admin_auth(headers):
    """Check that the request includes a valid admin token.

    Returns True if authorized, False otherwise.
    """
    auth_header = headers.get("Authorization", "") if headers else ""
    if not auth_header.startswith("Bearer "):
        return False
    token = auth_header[len("Bearer "):]
    return token == ADMIN_TOKEN


def auto_expire_giveaways():
    """Check all active giveaways and expire any with past end_time."""
    global _last_expire_check
    now_ts = time.time()
    if now_ts - _last_expire_check < 60:
        return
    _last_expire_check = now_ts

    giveaways = database.get_all_giveaways(status_filter="active")
    now = datetime.now(timezone.utc)
    for g in giveaways:
        if g.get("end_time"):
            try:
                end_time = datetime.fromisoformat(g["end_time"])
                # Add UTC timezone if naive
                if end_time.tzinfo is None:
                    end_time = end_time.replace(tzinfo=timezone.utc)
                if end_time < now:
                    database.update_giveaway(g["id"], {"status": "expired"})
            except (ValueError, TypeError):
                pass


def parse_multipart(body_bytes, content_type):
    """Parse multipart/form-data body and extract file data.

    Returns dict with 'filename' and 'content' keys, or None on failure.
    """
    # Extract boundary from content-type header
    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part[len("boundary="):]
            # Remove surrounding quotes if present
            if boundary.startswith('"') and boundary.endswith('"'):
                boundary = boundary[1:-1]
            break

    if not boundary:
        return None

    boundary_bytes = ("--" + boundary).encode("utf-8")

    # Split body by boundary
    parts = body_bytes.split(boundary_bytes)

    for part in parts:
        if not part or part == b"--\r\n" or part == b"--":
            continue

        # Separate headers from content
        header_end = part.find(b"\r\n\r\n")
        if header_end == -1:
            continue

        header_section = part[:header_end].decode("utf-8", errors="replace")
        content = part[header_end + 4:]

        # Remove trailing \r\n
        if content.endswith(b"\r\n"):
            content = content[:-2]

        # Check if this part has a filename (it's a file upload)
        filename = None
        is_file_field = False
        for line in header_section.split("\r\n"):
            if "Content-Disposition" in line and 'name="image"' in line:
                is_file_field = True
                # Extract filename
                if "filename=" in line:
                    fn_start = line.index("filename=") + len("filename=")
                    fn_str = line[fn_start:].strip()
                    if fn_str.startswith('"'):
                        fn_end = fn_str.index('"', 1)
                        filename = fn_str[1:fn_end]
                    else:
                        filename = fn_str.split(";")[0].strip()

        if is_file_field and filename:
            return {"filename": filename, "content": content}

    return None


def handle_admin_upload(path_parts, body, headers=None, raw_body=None):
    """POST /api/admin/upload - upload an image file."""
    content_type = ""
    if headers:
        content_type = headers.get("Content-Type", "") or headers.get("content-type", "")

    if not raw_body:
        return (400, {"error": "No file data received"})

    if len(raw_body) > MAX_UPLOAD_SIZE:
        return (400, {"error": "File too large (max 5MB)"})

    result = parse_multipart(raw_body, content_type)
    if not result:
        return (400, {"error": "Invalid file upload"})

    filename = result["filename"]
    content = result["content"]

    # Validate extension
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        return (400, {"error": "Extension non autorisee. Formats acceptes: jpg, jpeg, png, gif, webp"})

    # Generate unique filename
    unique_name = secrets.token_hex(8) + ext
    save_path = UPLOAD_DIR / unique_name

    os.makedirs(str(UPLOAD_DIR), exist_ok=True)

    with open(str(save_path), "wb") as f:
        f.write(content)

    return (200, {"url": "/static/uploads/" + unique_name})


def handle_get_recent_activity(path_parts, body, headers=None):
    """GET /api/recent-activity - return last 5 real participations."""
    activity = database.get_recent_activity(5)
    return (200, activity)


def handle_get_giveaways(path_parts, body, headers=None):
    """GET /api/giveaways - list active giveaways."""
    auto_expire_giveaways()
    cached = _cache_get("giveaways")
    if cached is not None:
        return (200, cached)
    giveaways = database.get_all_giveaways(status_filter="active")
    _cache_set("giveaways", giveaways)
    return (200, giveaways)


def handle_get_public_participants(path_parts, body, headers=None):
    """GET /api/giveaways/{id}/participants - public endpoint returning usernames only."""
    giveaway_id = int(path_parts[2])
    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})
    participants = database.get_giveaway_participants(giveaway_id)
    return (200, [{"username": p["username"]} for p in participants])


def handle_get_giveaway(path_parts, body, headers=None):
    """GET /api/giveaways/{id} - single giveaway detail."""
    auto_expire_giveaways()
    giveaway_id = int(path_parts[2])
    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})
    return (200, giveaway)


def handle_participate(path_parts, body, headers=None):
    """POST /api/giveaways/{id}/participate - create ticket for user."""
    giveaway_id = int(path_parts[2])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    if giveaway["status"] != "active":
        return (400, {"error": "Giveaway is no longer active"})

    # Check if end_time has passed
    if giveaway.get("end_time"):
        try:
            end_time = datetime.fromisoformat(giveaway["end_time"])
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            if end_time < datetime.now(timezone.utc):
                return (400, {"error": "Ce giveaway est termine"})
        except (ValueError, TypeError):
            pass

    # Enforce max_participants
    max_p = giveaway.get("max_participants")
    if max_p and max_p > 0 and giveaway["current_participants"] >= max_p:
        return (400, {"error": "Giveaway complet"})

    if not body or "username" not in body or "email" not in body:
        return (400, {"error": "username and email are required"})

    username = body["username"]
    email = body["email"]

    # Email validation
    if not _is_valid_email(email):
        return (400, {"error": "Adresse email invalide"})

    # Anti-fraud: extract IP and fingerprint
    ip_address = ""
    if headers:
        # Try X-Forwarded-For first (proxy), then X-Real-Ip, then Remote-Addr (WSGI direct)
        ip_address = headers.get("X-Forwarded-For", "") or headers.get("X-Real-Ip", "") or headers.get("Remote-Addr", "") or ""
        # Take first IP if X-Forwarded-For has multiple
        if "," in ip_address:
            ip_address = ip_address.split(",")[0].strip()

    fingerprint = body.get("fingerprint", "")

    # Rate limiting: max 10 participations per IP per hour
    if ip_address:
        recent_count = database.get_recent_participations_by_ip(ip_address)
        if recent_count >= 10:
            return (429, {"error": "Trop de participations recentes. Veuillez reessayer plus tard."})

    # Multi-account detection
    if fingerprint:
        multi_count = database.check_fingerprint_multi_account(fingerprint)
        if multi_count >= 5:
            return (400, {"error": "Activite suspecte detectee sur cet appareil."})

    # Anti-fraud: ALWAYS check for duplicate participation
    # 1. Same email already participated in this giveaway
    if database.check_email_participated(giveaway_id, email):
        return (400, {"error": "Cette adresse email a deja participe a ce giveaway"})

    # 2. Same IP (if available)
    if ip_address and database.check_ip_participated(giveaway_id, ip_address):
        return (400, {"error": "Une participation a deja ete enregistree depuis cette connexion"})

    # 3. Same fingerprint (if available)
    if fingerprint and database.check_fingerprint_participated(giveaway_id, fingerprint):
        return (400, {"error": "Une participation a deja ete enregistree depuis cet appareil"})

    user = database.get_or_create_user(username, email)

    try:
        ticket = database.create_ticket(user["id"], giveaway_id)
    except ValueError:
        return (400, {"error": "Vous participez deja a ce giveaway"})

    # Record fingerprint for anti-fraud (always record, include email)
    database.record_participation_fingerprint(giveaway_id, user["id"], ip_address, fingerprint, email)

    # Invalidate cache on participation
    _cache_invalidate()

    return (201, {
        "ticket": ticket,
        "user": user,
        "message": "Participation successful!"
    })


def handle_get_winners(path_parts, body, headers=None):
    """GET /api/winners - list past winners."""
    cached = _cache_get("winners")
    if cached is not None:
        return (200, cached)
    winners = database.get_winners()
    _cache_set("winners", winners)
    return (200, winners)


def handle_get_stats(path_parts, body, headers=None):
    """GET /api/stats - platform statistics."""
    cached = _cache_get("stats")
    if cached is not None:
        return (200, cached)
    stats = database.get_stats()
    _cache_set("stats", stats)
    return (200, stats)


def handle_contact(path_parts, body, headers=None):
    """POST /api/contact - store a contact form message."""
    if not body:
        return (400, {"error": "Request body is required"})

    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    message = body.get("message", "").strip()

    if not name or not email or not message:
        return (400, {"error": "name, email, and message are required"})

    if "@" not in email:
        return (400, {"error": "Invalid email address"})

    result = database.create_contact_message(name, email, message)
    return (201, {"message": "Message envoye avec succes", "id": result["id"]})


def handle_admin_create_giveaway(path_parts, body, headers=None):
    """POST /api/admin/giveaways - create new giveaway."""
    if not body or "title" not in body:
        return (400, {"error": "title is required"})

    giveaway = database.create_giveaway(body)
    _cache_invalidate()
    return (201, giveaway)


def handle_admin_update_giveaway(path_parts, body, headers=None):
    """PUT /api/admin/giveaways/{id} - update giveaway."""
    giveaway_id = int(path_parts[3])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    if not body:
        return (400, {"error": "Request body is required"})

    updated = database.update_giveaway(giveaway_id, body)
    _cache_invalidate()
    return (200, updated)


def handle_admin_draw_winner(path_parts, body, headers=None):
    """POST /api/admin/giveaways/{id}/draw - perform random draw."""
    giveaway_id = int(path_parts[3])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    if giveaway["status"] != "active":
        return (400, {"error": "Giveaway is not active"})

    winner = database.draw_winner(giveaway_id)
    if not winner:
        return (400, {"error": "No participants to draw from"})

    _cache_invalidate()
    return (200, {"winner": winner, "message": "Winner drawn successfully!"})


def handle_admin_update_shipping(path_parts, body, headers=None):
    """PUT /api/admin/winners/{id}/shipping - update shipping status."""
    winner_id = int(path_parts[3])

    if not body:
        return (400, {"error": "Request body is required"})

    status = body.get("status", "pending")
    proof_url = body.get("proof_url", "")

    updated = database.update_shipping(winner_id, status, proof_url)
    if not updated:
        return (404, {"error": "Winner not found"})

    return (200, updated)


def handle_admin_delete_giveaway(path_parts, body, headers=None):
    """DELETE /api/admin/giveaways/{id} - delete a giveaway."""
    giveaway_id = int(path_parts[3])

    deleted = database.delete_giveaway(giveaway_id)
    if not deleted:
        return (404, {"error": "Giveaway not found"})

    _cache_invalidate()
    return (200, {"message": "Giveaway supprime"})


def handle_admin_delete_winner(path_parts, body, headers=None):
    """DELETE /api/admin/winners/{id} - delete a winner and reset giveaway."""
    winner_id = int(path_parts[3])

    deleted = database.delete_winner(winner_id)
    if not deleted:
        return (404, {"error": "Winner not found"})

    _cache_invalidate()
    return (200, {"message": "Gagnant supprime"})


def handle_admin_list_giveaways(path_parts, body, headers=None):
    """GET /api/admin/giveaways - list ALL giveaways."""
    giveaways = database.get_all_giveaways()
    return (200, giveaways)


def handle_admin_get_messages(path_parts, body, headers=None):
    """GET /api/admin/messages - list all contact messages."""
    messages = database.get_all_contact_messages()
    return (200, messages)


def handle_admin_get_participants(path_parts, body, headers=None):
    """GET /api/admin/giveaways/{id}/participants - list participants."""
    giveaway_id = int(path_parts[3])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    participants = database.get_giveaway_participants(giveaway_id)
    return (200, participants)


def handle_admin_all_participants(path_parts, body, headers=None):
    """GET /api/admin/all-participants - list all participants across all giveaways."""
    participants = database.get_all_participants()
    return (200, participants)


def route_request(method, path_parts, body, headers=None, raw_body=None):
    """Route a request to the appropriate handler.

    Path parts are split from URL like:
      /api/giveaways -> ['api', 'giveaways']
      /api/giveaways/1 -> ['api', 'giveaways', '1']
      /api/giveaways/1/participate -> ['api', 'giveaways', '1', 'participate']
      /api/admin/giveaways -> ['api', 'admin', 'giveaways']
      /api/admin/giveaways/1 -> ['api', 'admin', 'giveaways', '1']
      /api/admin/giveaways/1/draw -> ['api', 'admin', 'giveaways', '1', 'draw']
      /api/admin/winners/1/shipping -> ['api', 'admin', 'winners', '1', 'shipping']
    """
    path_str = "/".join(path_parts)

    # Public API routes
    # GET /api/recent-activity
    if method == "GET" and path_str == "api/recent-activity":
        return handle_get_recent_activity(path_parts, body, headers)

    # GET /api/giveaways
    if method == "GET" and path_str == "api/giveaways":
        return handle_get_giveaways(path_parts, body, headers)

    # GET /api/giveaways/{id}
    if method == "GET" and len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "giveaways":
        try:
            int(path_parts[2])
            return handle_get_giveaway(path_parts, body, headers)
        except (ValueError, IndexError):
            pass

    # GET /api/giveaways/{id}/participants (public - usernames only)
    if method == "GET" and len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "giveaways" and path_parts[3] == "participants":
        return handle_get_public_participants(path_parts, body, headers)

    # POST /api/giveaways/{id}/participate
    if method == "POST" and len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "giveaways" and path_parts[3] == "participate":
        return handle_participate(path_parts, body, headers)

    # GET /api/winners
    if method == "GET" and path_str == "api/winners":
        return handle_get_winners(path_parts, body, headers)

    # GET /api/stats
    if method == "GET" and path_str == "api/stats":
        return handle_get_stats(path_parts, body, headers)

    # POST /api/contact
    if method == "POST" and path_str == "api/contact":
        return handle_contact(path_parts, body, headers)

    # Admin API routes - require authentication
    if len(path_parts) >= 2 and path_parts[1] == "admin":
        if not check_admin_auth(headers):
            return (401, {"error": "Unauthorized"})

        # POST /api/admin/upload
        if method == "POST" and path_str == "api/admin/upload":
            return handle_admin_upload(path_parts, body, headers, raw_body=raw_body)

        # GET /api/admin/giveaways
        if method == "GET" and path_str == "api/admin/giveaways":
            return handle_admin_list_giveaways(path_parts, body, headers)

        # GET /api/admin/messages
        if method == "GET" and path_str == "api/admin/messages":
            return handle_admin_get_messages(path_parts, body, headers)

        # GET /api/admin/all-participants
        if method == "GET" and path_str == "api/admin/all-participants":
            return handle_admin_all_participants(path_parts, body, headers)

        # POST /api/admin/giveaways
        if method == "POST" and path_str == "api/admin/giveaways":
            return handle_admin_create_giveaway(path_parts, body, headers)

        # GET /api/admin/giveaways/{id}/participants
        if method == "GET" and len(path_parts) == 5 and path_parts[2] == "giveaways" and path_parts[4] == "participants":
            return handle_admin_get_participants(path_parts, body, headers)

        # PUT /api/admin/giveaways/{id}
        if method == "PUT" and len(path_parts) == 4 and path_parts[2] == "giveaways":
            try:
                int(path_parts[3])
                return handle_admin_update_giveaway(path_parts, body, headers)
            except (ValueError, IndexError):
                pass

        # DELETE /api/admin/giveaways/{id}
        if method == "DELETE" and len(path_parts) == 4 and path_parts[2] == "giveaways":
            try:
                int(path_parts[3])
                return handle_admin_delete_giveaway(path_parts, body, headers)
            except (ValueError, IndexError):
                pass

        # POST /api/admin/giveaways/{id}/draw
        if method == "POST" and len(path_parts) == 5 and path_parts[2] == "giveaways" and path_parts[4] == "draw":
            return handle_admin_draw_winner(path_parts, body, headers)

        # PUT /api/admin/winners/{id}/shipping
        if method == "PUT" and len(path_parts) == 5 and path_parts[2] == "winners" and path_parts[4] == "shipping":
            return handle_admin_update_shipping(path_parts, body, headers)

        # DELETE /api/admin/winners/{id}
        if method == "DELETE" and len(path_parts) == 4 and path_parts[2] == "winners":
            try:
                int(path_parts[3])
                return handle_admin_delete_winner(path_parts, body, headers)
            except (ValueError, IndexError):
                pass

    return (404, {"error": "Not found"})
