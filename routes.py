"""API route handlers for Windrop giveaway platform."""

import json
import database


def handle_get_giveaways(path_parts, body):
    """GET /api/giveaways - list active giveaways."""
    giveaways = database.get_all_giveaways(status_filter="active")
    return (200, giveaways)


def handle_get_giveaway(path_parts, body):
    """GET /api/giveaways/{id} - single giveaway detail."""
    giveaway_id = int(path_parts[2])
    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})
    return (200, giveaway)


def handle_participate(path_parts, body):
    """POST /api/giveaways/{id}/participate - create ticket for user."""
    giveaway_id = int(path_parts[2])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    if giveaway["status"] != "active":
        return (400, {"error": "Giveaway is no longer active"})

    if not body or "username" not in body or "email" not in body:
        return (400, {"error": "username and email are required"})

    username = body["username"]
    email = body["email"]

    user = database.get_or_create_user(username, email)
    ticket = database.create_ticket(user["id"], giveaway_id)

    return (201, {
        "ticket": ticket,
        "user": user,
        "message": "Participation successful!"
    })


def handle_get_winners(path_parts, body):
    """GET /api/winners - list past winners."""
    winners = database.get_winners()
    return (200, winners)


def handle_get_stats(path_parts, body):
    """GET /api/stats - platform statistics."""
    stats = database.get_stats()
    return (200, stats)


def handle_admin_create_giveaway(path_parts, body):
    """POST /api/admin/giveaways - create new giveaway."""
    if not body or "title" not in body:
        return (400, {"error": "title is required"})

    giveaway = database.create_giveaway(body)
    return (201, giveaway)


def handle_admin_update_giveaway(path_parts, body):
    """PUT /api/admin/giveaways/{id} - update giveaway."""
    giveaway_id = int(path_parts[3])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    if not body:
        return (400, {"error": "Request body is required"})

    updated = database.update_giveaway(giveaway_id, body)
    return (200, updated)


def handle_admin_draw_winner(path_parts, body):
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


def handle_admin_update_shipping(path_parts, body):
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


def handle_admin_list_giveaways(path_parts, body):
    """GET /api/admin/giveaways - list ALL giveaways."""
    giveaways = database.get_all_giveaways()
    return (200, giveaways)


def handle_admin_get_participants(path_parts, body):
    """GET /api/admin/giveaways/{id}/participants - list participants."""
    giveaway_id = int(path_parts[3])

    giveaway = database.get_giveaway(giveaway_id)
    if not giveaway:
        return (404, {"error": "Giveaway not found"})

    participants = database.get_giveaway_participants(giveaway_id)
    return (200, participants)


def route_request(method, path_parts, body):
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
        return handle_get_giveaways(path_parts, body)

    # GET /api/giveaways/{id}
    if method == "GET" and len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "giveaways":
        try:
            int(path_parts[2])
            return handle_get_giveaway(path_parts, body)
        except (ValueError, IndexError):
            pass

    # POST /api/giveaways/{id}/participate
    if method == "POST" and len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "giveaways" and path_parts[3] == "participate":
        return handle_participate(path_parts, body)

    # GET /api/winners
    if method == "GET" and path_str == "api/winners":
        return handle_get_winners(path_parts, body)

    # GET /api/stats
    if method == "GET" and path_str == "api/stats":
        return handle_get_stats(path_parts, body)

    # Admin API routes
    # GET /api/admin/giveaways
    if method == "GET" and path_str == "api/admin/giveaways":
        return handle_admin_list_giveaways(path_parts, body)

    # POST /api/admin/giveaways
    if method == "POST" and path_str == "api/admin/giveaways":
        return handle_admin_create_giveaway(path_parts, body)

    # GET /api/admin/giveaways/{id}/participants
    if method == "GET" and len(path_parts) == 5 and path_parts[1] == "admin" and path_parts[2] == "giveaways" and path_parts[4] == "participants":
        return handle_admin_get_participants(path_parts, body)

    # PUT /api/admin/giveaways/{id}
    if method == "PUT" and len(path_parts) == 4 and path_parts[1] == "admin" and path_parts[2] == "giveaways":
        try:
            int(path_parts[3])
            return handle_admin_update_giveaway(path_parts, body)
        except (ValueError, IndexError):
            pass

    # POST /api/admin/giveaways/{id}/draw
    if method == "POST" and len(path_parts) == 5 and path_parts[1] == "admin" and path_parts[2] == "giveaways" and path_parts[4] == "draw":
        return handle_admin_draw_winner(path_parts, body)

    # PUT /api/admin/winners/{id}/shipping
    if method == "PUT" and len(path_parts) == 5 and path_parts[1] == "admin" and path_parts[2] == "winners" and path_parts[4] == "shipping":
        return handle_admin_update_shipping(path_parts, body)

    return (404, {"error": "Not found"})
