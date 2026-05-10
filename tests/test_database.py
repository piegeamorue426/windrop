"""Unit tests for database module."""

import sys
import unittest
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))
import database


class TestDatabase(unittest.TestCase):
    """Test cases for database operations."""

    def setUp(self):
        """Set up test database using a temporary file."""
        self._original_db_path = database.DB_PATH
        database.DB_PATH = Path(__file__).parent / "test_windrop.db"
        # Remove any existing test database
        if database.DB_PATH.exists():
            database.DB_PATH.unlink()
        database.init_db()

    def tearDown(self):
        """Clean up test database."""
        if database.DB_PATH.exists():
            database.DB_PATH.unlink()
        database.DB_PATH = self._original_db_path

    def test_init_db_creates_tables(self):
        """Test that init_db creates all required tables."""
        conn = database.get_connection()
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row["name"] for row in cursor.fetchall()]
        conn.close()

        self.assertIn("giveaways", tables)
        self.assertIn("users", tables)
        self.assertIn("tickets", tables)
        self.assertIn("winners", tables)

    def test_create_giveaway(self):
        """Test creating a giveaway."""
        data = {
            "title": "Test Giveaway",
            "description": "A test giveaway",
            "price": 9.99,
            "condition": "Neuf - Scelle",
            "max_participants": 50,
            "end_time": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
        }
        giveaway = database.create_giveaway(data)

        self.assertIsNotNone(giveaway)
        self.assertEqual(giveaway["title"], "Test Giveaway")
        self.assertEqual(giveaway["price"], 9.99)
        self.assertEqual(giveaway["status"], "active")
        self.assertEqual(giveaway["current_participants"], 0)

    def test_get_giveaway(self):
        """Test getting a single giveaway by ID."""
        data = {
            "title": "Another Giveaway",
            "description": "Description here",
            "price": 19.99,
        }
        created = database.create_giveaway(data)
        fetched = database.get_giveaway(created["id"])

        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], created["id"])
        self.assertEqual(fetched["title"], "Another Giveaway")

    def test_get_giveaway_not_found(self):
        """Test getting a non-existent giveaway returns None."""
        result = database.get_giveaway(99999)
        self.assertIsNone(result)

    def test_get_or_create_user_creates_new(self):
        """Test creating a new user."""
        user = database.get_or_create_user("testuser", "test@example.com")

        self.assertIsNotNone(user)
        self.assertEqual(user["username"], "testuser")
        self.assertEqual(user["email"], "test@example.com")
        self.assertIsNotNone(user["id"])

    def test_get_or_create_user_returns_existing(self):
        """Test that getting an existing user returns the same user."""
        user1 = database.get_or_create_user("sameuser", "same@example.com")
        user2 = database.get_or_create_user("sameuser", "different@example.com")

        self.assertEqual(user1["id"], user2["id"])
        self.assertEqual(user2["username"], "sameuser")

    def test_create_ticket_increments_count(self):
        """Test that creating a ticket increments participant count."""
        giveaway = database.create_giveaway({
            "title": "Ticket Test",
            "price": 5.99,
        })
        user = database.get_or_create_user("ticketuser", "ticket@test.com")

        self.assertEqual(giveaway["current_participants"], 0)

        database.create_ticket(user["id"], giveaway["id"])

        updated = database.get_giveaway(giveaway["id"])
        self.assertEqual(updated["current_participants"], 1)

        # Create another ticket
        user2 = database.get_or_create_user("ticketuser2", "ticket2@test.com")
        database.create_ticket(user2["id"], giveaway["id"])

        updated = database.get_giveaway(giveaway["id"])
        self.assertEqual(updated["current_participants"], 2)

    def test_draw_winner_selects_from_participants(self):
        """Test that draw_winner selects a winner from actual participants."""
        giveaway = database.create_giveaway({
            "title": "Draw Test",
            "price": 10.00,
        })
        user1 = database.get_or_create_user("drawuser1", "draw1@test.com")
        user2 = database.get_or_create_user("drawuser2", "draw2@test.com")
        user3 = database.get_or_create_user("drawuser3", "draw3@test.com")

        database.create_ticket(user1["id"], giveaway["id"])
        database.create_ticket(user2["id"], giveaway["id"])
        database.create_ticket(user3["id"], giveaway["id"])

        winner = database.draw_winner(giveaway["id"])

        self.assertIsNotNone(winner)
        self.assertEqual(winner["giveaway_id"], giveaway["id"])
        self.assertIn(winner["user_id"], [user1["id"], user2["id"], user3["id"]])
        self.assertEqual(winner["shipping_status"], "pending")

        # Giveaway should now be ended
        updated = database.get_giveaway(giveaway["id"])
        self.assertEqual(updated["status"], "ended")

    def test_draw_winner_no_participants(self):
        """Test that draw_winner returns None if no participants."""
        giveaway = database.create_giveaway({
            "title": "Empty Draw Test",
            "price": 10.00,
        })
        result = database.draw_winner(giveaway["id"])
        self.assertIsNone(result)

    def test_get_winners(self):
        """Test getting winners list with details."""
        giveaway = database.create_giveaway({
            "title": "Winners Test",
            "price": 15.00,
        })
        user = database.get_or_create_user("winneruser", "winner@test.com")
        database.create_ticket(user["id"], giveaway["id"])
        database.draw_winner(giveaway["id"])

        winners = database.get_winners()
        self.assertGreater(len(winners), 0)
        self.assertEqual(winners[0]["giveaway_title"], "Winners Test")
        self.assertEqual(winners[0]["username"], "winneruser")

    def test_update_shipping(self):
        """Test updating shipping status."""
        giveaway = database.create_giveaway({
            "title": "Shipping Test",
            "price": 20.00,
        })
        user = database.get_or_create_user("shipuser", "ship@test.com")
        database.create_ticket(user["id"], giveaway["id"])
        winner = database.draw_winner(giveaway["id"])

        updated = database.update_shipping(winner["id"], "shipped", "https://proof.url/img.jpg")
        self.assertEqual(updated["shipping_status"], "shipped")
        self.assertEqual(updated["shipping_proof_url"], "https://proof.url/img.jpg")

    def test_get_stats(self):
        """Test getting platform statistics."""
        database.create_giveaway({"title": "Stats Test 1", "price": 5.00})
        database.create_giveaway({"title": "Stats Test 2", "price": 10.00})
        user = database.get_or_create_user("statsuser", "stats@test.com")
        database.create_ticket(user["id"], 1)

        stats = database.get_stats()
        self.assertGreaterEqual(stats["total_giveaways"], 2)
        self.assertGreaterEqual(stats["total_participants"], 1)
        self.assertIsInstance(stats["total_winners"], int)

    def test_get_giveaway_participants(self):
        """Test getting participants for a giveaway."""
        giveaway = database.create_giveaway({
            "title": "Participants Test",
            "price": 5.00,
        })
        user1 = database.get_or_create_user("part1", "part1@test.com")
        user2 = database.get_or_create_user("part2", "part2@test.com")
        database.create_ticket(user1["id"], giveaway["id"])
        database.create_ticket(user2["id"], giveaway["id"])

        participants = database.get_giveaway_participants(giveaway["id"])
        self.assertEqual(len(participants), 2)
        usernames = [p["username"] for p in participants]
        self.assertIn("part1", usernames)
        self.assertIn("part2", usernames)


    def test_get_recent_participations_by_ip(self):
        """Test counting recent participations by IP."""
        giveaway = database.create_giveaway({
            "title": "IP Count Test",
            "price": 5.0,
        })
        user1 = database.get_or_create_user("ipuser1", "ip1@test.com")
        user2 = database.get_or_create_user("ipuser2", "ip2@test.com")

        # Record some fingerprints from same IP
        database.record_participation_fingerprint(giveaway["id"], user1["id"], "1.2.3.4", "fp1")
        database.record_participation_fingerprint(giveaway["id"], user2["id"], "1.2.3.4", "fp2")

        # Different IP
        database.record_participation_fingerprint(giveaway["id"], user1["id"], "5.6.7.8", "fp3")

        count = database.get_recent_participations_by_ip("1.2.3.4")
        self.assertEqual(count, 2)

        count_other = database.get_recent_participations_by_ip("5.6.7.8")
        self.assertEqual(count_other, 1)

        count_none = database.get_recent_participations_by_ip("9.9.9.9")
        self.assertEqual(count_none, 0)

    def test_check_fingerprint_multi_account(self):
        """Test counting distinct users for a fingerprint."""
        giveaway = database.create_giveaway({
            "title": "Multi Account Count Test",
            "price": 5.0,
        })
        # Record same fingerprint for multiple users
        for i in range(4):
            user = database.get_or_create_user(f"fpuser{i}", f"fpuser{i}@test.com")
            database.record_participation_fingerprint(
                giveaway["id"], user["id"], f"10.0.0.{i}", "same_fp"
            )

        count = database.check_fingerprint_multi_account("same_fp")
        self.assertEqual(count, 4)

        # Different fingerprint should return 0
        count_other = database.check_fingerprint_multi_account("other_fp")
        self.assertEqual(count_other, 0)


if __name__ == "__main__":
    unittest.main()
