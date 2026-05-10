"""SQLite database module for Windrop giveaway platform."""

import os
import sqlite3
import secrets
from datetime import datetime, timezone
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent / "static" / "uploads"

DB_PATH = Path(os.environ.get("WINDROP_DB_PATH", str(Path(__file__).parent / "windrop.db")))


def get_connection():
    """Get a database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create all database tables."""
    # Ensure uploads directory exists
    os.makedirs(str(UPLOAD_DIR), exist_ok=True)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS giveaways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            price REAL,
            source_url TEXT,
            condition TEXT,
            max_participants INTEGER,
            current_participants INTEGER DEFAULT 0,
            end_time TEXT,
            status TEXT DEFAULT 'active',
            winner_id INTEGER,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            giveaway_id INTEGER NOT NULL,
            payment_status TEXT DEFAULT 'completed',
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (giveaway_id) REFERENCES giveaways(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS winners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giveaway_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            ticket_id INTEGER NOT NULL,
            drawn_at TEXT,
            shipping_status TEXT DEFAULT 'pending',
            shipping_proof_url TEXT,
            FOREIGN KEY (giveaway_id) REFERENCES giveaways(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS participation_fingerprints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giveaway_id INTEGER NOT NULL,
            ip_address TEXT,
            fingerprint TEXT,
            user_id INTEGER NOT NULL,
            created_at TEXT,
            FOREIGN KEY (giveaway_id) REFERENCES giveaways(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Performance indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_giveaways_created_at ON giveaways(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_user_giveaway ON tickets(user_id, giveaway_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_giveaway ON tickets(giveaway_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_winners_giveaway ON winners(giveaway_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fingerprints_giveaway_ip ON participation_fingerprints(giveaway_id, ip_address)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fingerprints_giveaway_fp ON participation_fingerprints(giveaway_id, fingerprint)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fingerprints_ip_created ON participation_fingerprints(ip_address, created_at)")

    conn.commit()
    conn.close()


def get_all_giveaways(status_filter=None):
    """Get all giveaways, optionally filtered by status."""
    conn = get_connection()
    if status_filter:
        cursor = conn.execute(
            "SELECT * FROM giveaways WHERE status = ? ORDER BY created_at DESC",
            (status_filter,)
        )
    else:
        cursor = conn.execute("SELECT * FROM giveaways ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_giveaway(giveaway_id):
    """Get a single giveaway by ID."""
    conn = get_connection()
    cursor = conn.execute("SELECT * FROM giveaways WHERE id = ?", (giveaway_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def create_giveaway(data):
    """Create a new giveaway."""
    conn = get_connection()
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        """INSERT INTO giveaways (title, description, image_url, price, source_url,
           condition, max_participants, end_time, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("title"),
            data.get("description"),
            data.get("image_url"),
            data.get("price"),
            data.get("source_url"),
            data.get("condition"),
            data.get("max_participants"),
            data.get("end_time"),
            data.get("status", "active"),
            now
        )
    )
    giveaway_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_giveaway(giveaway_id)


def update_giveaway(giveaway_id, data):
    """Update an existing giveaway."""
    conn = get_connection()
    fields = []
    values = []
    for key in ("title", "description", "image_url", "price", "source_url",
                "condition", "max_participants", "end_time", "status", "winner_id"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if not fields:
        conn.close()
        return get_giveaway(giveaway_id)

    values.append(giveaway_id)
    query = f"UPDATE giveaways SET {', '.join(fields)} WHERE id = ?"
    conn.execute(query, values)
    conn.commit()
    conn.close()
    return get_giveaway(giveaway_id)


def add_participant(giveaway_id, user_id):
    """Increment participant count for a giveaway."""
    conn = get_connection()
    conn.execute(
        "UPDATE giveaways SET current_participants = current_participants + 1 WHERE id = ?",
        (giveaway_id,)
    )
    conn.commit()
    conn.close()


def get_or_create_user(username, email):
    """Get an existing user or create a new one."""
    conn = get_connection()
    cursor = conn.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if row:
        conn.close()
        return dict(row)

    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO users (username, email, created_at) VALUES (?, ?, ?)",
        (username, email, now)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    conn = get_connection()
    cursor = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)


def create_ticket(user_id, giveaway_id):
    """Create a ticket for a user in a giveaway.

    Raises ValueError if user already has a ticket for this giveaway.
    """
    conn = get_connection()

    # Check for duplicate participation
    cursor = conn.execute(
        "SELECT id FROM tickets WHERE user_id = ? AND giveaway_id = ?",
        (user_id, giveaway_id)
    )
    if cursor.fetchone():
        conn.close()
        raise ValueError("Duplicate participation")

    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO tickets (user_id, giveaway_id, payment_status, created_at) VALUES (?, ?, 'completed', ?)",
        (user_id, giveaway_id, now)
    )
    ticket_id = cursor.lastrowid
    conn.commit()
    conn.close()

    add_participant(giveaway_id, user_id)

    conn = get_connection()
    cursor = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)


def draw_winner(giveaway_id):
    """Draw a random winner from participants using secrets.randbelow for secure randomness."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM tickets WHERE giveaway_id = ? AND payment_status = 'completed'",
        (giveaway_id,)
    )
    tickets = cursor.fetchall()
    conn.close()

    if not tickets:
        return None

    # Use secrets.randbelow for cryptographically secure random selection
    winner_index = secrets.randbelow(len(tickets))
    winning_ticket = dict(tickets[winner_index])

    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO winners (giveaway_id, user_id, ticket_id, drawn_at, shipping_status)
           VALUES (?, ?, ?, ?, 'pending')""",
        (giveaway_id, winning_ticket["user_id"], winning_ticket["id"], now)
    )
    winner_id = cursor.lastrowid

    # Update giveaway status
    conn.execute(
        "UPDATE giveaways SET status = 'ended', winner_id = ? WHERE id = ?",
        (winning_ticket["user_id"], giveaway_id)
    )
    conn.commit()
    conn.close()

    conn = get_connection()
    cursor = conn.execute("SELECT * FROM winners WHERE id = ?", (winner_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)


def get_winners():
    """Get all winners with giveaway and user details."""
    conn = get_connection()
    cursor = conn.execute("""
        SELECT w.*, g.title as giveaway_title, g.image_url as giveaway_image,
               g.price as giveaway_price, u.username
        FROM winners w
        JOIN giveaways g ON w.giveaway_id = g.id
        JOIN users u ON w.user_id = u.id
        ORDER BY w.drawn_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def update_shipping(winner_id, status, proof_url):
    """Update shipping status and proof URL for a winner."""
    conn = get_connection()
    conn.execute(
        "UPDATE winners SET shipping_status = ?, shipping_proof_url = ? WHERE id = ?",
        (status, proof_url, winner_id)
    )
    conn.commit()
    conn.close()

    conn = get_connection()
    cursor = conn.execute("SELECT * FROM winners WHERE id = ?", (winner_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def get_giveaway_participants(giveaway_id):
    """Get all participants for a giveaway."""
    conn = get_connection()
    cursor = conn.execute("""
        SELECT t.*, u.username, u.email
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.giveaway_id = ?
        ORDER BY t.created_at DESC
    """, (giveaway_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_stats():
    """Get platform statistics."""
    conn = get_connection()

    cursor = conn.execute("SELECT COUNT(*) as count FROM giveaways")
    total_giveaways = cursor.fetchone()["count"]

    cursor = conn.execute("SELECT COUNT(*) as count FROM tickets WHERE payment_status = 'completed'")
    total_participants = cursor.fetchone()["count"]

    cursor = conn.execute("SELECT COUNT(*) as count FROM winners")
    total_winners = cursor.fetchone()["count"]

    conn.close()
    return {
        "total_giveaways": total_giveaways,
        "total_participants": total_participants,
        "total_winners": total_winners
    }


def delete_giveaway(giveaway_id):
    """Delete a giveaway and all associated tickets and winners.

    Returns True if the giveaway existed and was deleted, False otherwise.
    """
    conn = get_connection()
    cursor = conn.execute("SELECT id FROM giveaways WHERE id = ?", (giveaway_id,))
    if not cursor.fetchone():
        conn.close()
        return False

    conn.execute("DELETE FROM winners WHERE giveaway_id = ?", (giveaway_id,))
    conn.execute("DELETE FROM tickets WHERE giveaway_id = ?", (giveaway_id,))
    conn.execute("DELETE FROM giveaways WHERE id = ?", (giveaway_id,))
    conn.commit()
    conn.close()
    return True


def create_contact_message(name, email, message):
    """Store a contact form message in the database."""
    conn = get_connection()
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO contact_messages (name, email, message, created_at) VALUES (?, ?, ?, ?)",
        (name, email, message, now)
    )
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": msg_id, "name": name, "email": email, "message": message, "created_at": now}


def get_all_contact_messages():
    """Get all contact messages ordered by date descending."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT * FROM contact_messages ORDER BY created_at DESC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def check_duplicate_participation(giveaway_id, ip_address, fingerprint):
    """Check if the same IP or fingerprint already participated in this giveaway.

    Returns True if duplicate detected, False otherwise.
    """
    conn = get_connection()
    cursor = conn.execute(
        """SELECT id FROM participation_fingerprints
           WHERE giveaway_id = ? AND (ip_address = ? OR fingerprint = ?)""",
        (giveaway_id, ip_address, fingerprint)
    )
    row = cursor.fetchone()
    conn.close()
    return row is not None


def record_participation_fingerprint(giveaway_id, user_id, ip_address, fingerprint):
    """Record participation fingerprint for anti-fraud tracking."""
    conn = get_connection()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO participation_fingerprints
           (giveaway_id, user_id, ip_address, fingerprint, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (giveaway_id, user_id, ip_address, fingerprint, now)
    )
    conn.commit()
    conn.close()


def get_recent_participations_by_ip(ip_address, hours=1):
    """Count participations from a given IP in the last N hours."""
    from datetime import timedelta
    conn = get_connection()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cursor = conn.execute(
        "SELECT COUNT(*) as count FROM participation_fingerprints WHERE ip_address = ? AND created_at > ?",
        (ip_address, cutoff)
    )
    count = cursor.fetchone()["count"]
    conn.close()
    return count


def check_fingerprint_multi_account(fingerprint):
    """Return the count of distinct user_ids associated with a fingerprint."""
    conn = get_connection()
    cursor = conn.execute(
        "SELECT COUNT(DISTINCT user_id) as count FROM participation_fingerprints WHERE fingerprint = ?",
        (fingerprint,)
    )
    count = cursor.fetchone()["count"]
    conn.close()
    return count
