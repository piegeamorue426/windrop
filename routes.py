"""API route handlers for Windrop giveaway platform."""

import json
import os
from datetime import datetime, timezone
import database

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "windrop-admin-2024")


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


def handle_get_giveaways(path_parts, body, headers=None):
    """GET /api/giveaways - list active giveaways."""
    auto_expire_giveaways()
    giveaways = database.get_all_giveaways(status_filter="active")
    return (200, giveaways)


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

    user = database.get_or_create_user(username, email)

    try:
        ticket = database.create_ticket(user["id"], giveaway_id)
    except ValueError:
        return (400, {"error": "Vous participez deja a ce giveaway"})

    return (201, {
        "ticket": ticket,
        "user": user,
        "message": "Participation successful!"
    })


def handle_get_winners(path_parts, body, headers=None):
    """GET /api/winners - list past winners."""
    winners = database.get_winners()
    return (200, winners)


def handle_get_stats(path_parts, body, headers=None):
    """GET /api/stats - platform statistics."""
    stats = database.get_stats()
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

    return (200, {"message": "Giveaway supprime"})


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


def route_request(method, path_parts, body, headers=None):
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

        # GET /api/admin/giveaways
        if method == "GET" and path_str == "api/admin/giveaways":
            return handle_admin_list_giveaways(path_parts, body, headers)

        # GET /api/admin/messages
        if method == "GET" and path_str == "api/admin/messages":
            return handle_admin_get_messages(path_parts, body, headers)

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

    return (404, {"error": "Not found"})
