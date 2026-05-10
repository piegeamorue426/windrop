"""Unit tests for route handlers."""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import database
import routes


class TestRoutes(unittest.TestCase):
    """Test cases for API route handlers."""

    def setUp(self):
        """Set up test database."""
        self._original_db_path = database.DB_PATH
        database.DB_PATH = Path(__file__).parent / "test_routes.db"
        if database.DB_PATH.exists():
            database.DB_PATH.unlink()
        database.init_db()

    def tearDown(self):
        """Clean up test database."""
        if database.DB_PATH.exists():
            database.DB_PATH.unlink()
        database.DB_PATH = self._original_db_path

    def _admin_headers(self):
        """Return valid admin auth headers."""
        return {"Authorization": "Bearer " + routes.ADMIN_TOKEN}

    def test_path_traversal_rejected(self):
        """Test that path traversal attempts in giveaway IDs are rejected."""
        # Attempting to use path traversal in giveaway ID should fail
        # The route_request won't match non-numeric IDs
        status, data = routes.route_request(
            "GET", ["api", "giveaways", "..%2F..%2Fetc%2Fpasswd"], None
        )
        # Should not match any valid route (non-numeric ID)
        self.assertEqual(status, 404)

    def test_path_traversal_non_numeric_id(self):
        """Test that non-numeric IDs don't reach handlers."""
        status, data = routes.route_request(
            "GET", ["api", "giveaways", "../secret"], None
        )
        self.assertEqual(status, 404)

    def test_participate_on_ended_giveaway(self):
        """Test that participating in an ended giveaway returns error."""
        giveaway = database.create_giveaway({
            "title": "Ended Giveaway",
            "price": 10.0,
            "status": "ended"
        })
        path_parts = ["api", "giveaways", str(giveaway["id"]), "participate"]
        body = {"username": "testuser", "email": "test@test.com"}

        status, data = routes.route_request("POST", path_parts, body)

        self.assertEqual(status, 400)
        self.assertIn("no longer active", data["error"])

    def test_participate_duplicate_user_returns_error(self):
        """Test that duplicate participation returns a friendly error."""
        giveaway = database.create_giveaway({
            "title": "Duplicate Test",
            "price": 5.0,
        })
        path_parts = ["api", "giveaways", str(giveaway["id"]), "participate"]
        body = {"username": "dupuser", "email": "dup@test.com"}

        # First participation should succeed
        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 201)

        # Second participation with same user should fail
        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 400)
        self.assertIn("Vous participez deja", data["error"])

    def test_admin_endpoint_without_token_returns_401(self):
        """Test that admin endpoints without auth token return 401."""
        # No headers at all
        status, data = routes.route_request(
            "GET", ["api", "admin", "giveaways"], None, headers=None
        )
        self.assertEqual(status, 401)
        self.assertEqual(data["error"], "Unauthorized")

    def test_admin_endpoint_with_invalid_token_returns_401(self):
        """Test that admin endpoints with wrong token return 401."""
        headers = {"Authorization": "Bearer wrong-token"}
        status, data = routes.route_request(
            "GET", ["api", "admin", "giveaways"], None, headers=headers
        )
        self.assertEqual(status, 401)

    def test_admin_endpoint_with_valid_token_succeeds(self):
        """Test that admin endpoints with valid token work."""
        headers = self._admin_headers()
        status, data = routes.route_request(
            "GET", ["api", "admin", "giveaways"], None, headers=headers
        )
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_max_participants_enforcement(self):
        """Test that participation is rejected when giveaway is full."""
        giveaway = database.create_giveaway({
            "title": "Limited Giveaway",
            "price": 5.0,
            "max_participants": 2,
        })
        giveaway_id = giveaway["id"]

        # First participant
        path_parts = ["api", "giveaways", str(giveaway_id), "participate"]
        status, _ = routes.route_request(
            "POST", path_parts, {"username": "user1", "email": "u1@t.com"}
        )
        self.assertEqual(status, 201)

        # Second participant
        status, _ = routes.route_request(
            "POST", path_parts, {"username": "user2", "email": "u2@t.com"}
        )
        self.assertEqual(status, 201)

        # Third participant should be rejected
        status, data = routes.route_request(
            "POST", path_parts, {"username": "user3", "email": "u3@t.com"}
        )
        self.assertEqual(status, 400)
        self.assertIn("complet", data["error"])

    def test_max_participants_zero_means_unlimited(self):
        """Test that max_participants=0 means no limit."""
        giveaway = database.create_giveaway({
            "title": "Unlimited Giveaway",
            "price": 5.0,
            "max_participants": 0,
        })
        giveaway_id = giveaway["id"]
        path_parts = ["api", "giveaways", str(giveaway_id), "participate"]

        # Should allow participation
        status, _ = routes.route_request(
            "POST", path_parts, {"username": "unlim1", "email": "u1@t.com"}
        )
        self.assertEqual(status, 201)

    def test_max_participants_none_means_unlimited(self):
        """Test that max_participants=None means no limit."""
        giveaway = database.create_giveaway({
            "title": "No Limit Giveaway",
            "price": 5.0,
        })
        giveaway_id = giveaway["id"]
        path_parts = ["api", "giveaways", str(giveaway_id), "participate"]

        status, _ = routes.route_request(
            "POST", path_parts, {"username": "nolim1", "email": "n1@t.com"}
        )
        self.assertEqual(status, 201)

    def test_contact_endpoint(self):
        """Test the contact form endpoint."""
        path_parts = ["api", "contact"]
        body = {"name": "Test User", "email": "test@example.com", "message": "Hello"}

        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 201)
        self.assertIn("id", data)

    def test_contact_endpoint_missing_fields(self):
        """Test contact endpoint rejects missing fields."""
        path_parts = ["api", "contact"]
        body = {"name": "Test", "email": ""}

        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 400)

    def test_contact_endpoint_invalid_email(self):
        """Test contact endpoint rejects invalid email."""
        path_parts = ["api", "contact"]
        body = {"name": "Test", "email": "noemail", "message": "Hi"}

        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 400)
        self.assertIn("email", data["error"].lower())

    def test_admin_draw_requires_auth(self):
        """Test that admin draw endpoint requires authentication."""
        giveaway = database.create_giveaway({
            "title": "Auth Draw Test",
            "price": 5.0,
        })
        path_parts = ["api", "admin", "giveaways", str(giveaway["id"]), "draw"]

        status, data = routes.route_request("POST", path_parts, {}, headers=None)
        self.assertEqual(status, 401)

    def test_admin_create_requires_auth(self):
        """Test that admin create endpoint requires authentication."""
        path_parts = ["api", "admin", "giveaways"]
        body = {"title": "Should Fail"}

        status, data = routes.route_request("POST", path_parts, body, headers=None)
        self.assertEqual(status, 401)

    def test_admin_shipping_requires_auth(self):
        """Test that admin shipping endpoint requires authentication."""
        path_parts = ["api", "admin", "winners", "1", "shipping"]
        body = {"status": "shipped"}

        status, data = routes.route_request("PUT", path_parts, body, headers=None)
        self.assertEqual(status, 401)


    def test_email_validation_valid(self):
        """Test that valid emails pass validation."""
        valid_emails = ['test@example.com', 'user@domain.co.uk', 'a.b@c.d.e']
        for email in valid_emails:
            self.assertTrue(routes._is_valid_email(email), f"{email} should be valid")

    def test_email_validation_invalid(self):
        """Test that invalid emails fail validation."""
        invalid_emails = [
            'noemail', 'no@dot', 'space @test.com', '@domain.com',
            'user@.com', 'user@domain.', '', 'a@@b.com'
        ]
        for email in invalid_emails:
            self.assertFalse(routes._is_valid_email(email), f"{email} should be invalid")

    def test_rate_limiting_blocks_excessive_participations(self):
        """Test that rate limiting blocks after 10 participations from same IP."""
        giveaway = database.create_giveaway({
            "title": "Rate Limit Test",
            "price": 5.0,
        })

        # Record 10 fingerprints from the same IP to simulate 10 participations
        for i in range(10):
            user = database.get_or_create_user(f"rateuser{i}", f"rate{i}@test.com")
            database.record_participation_fingerprint(
                giveaway["id"], user["id"], "192.168.1.100", f"fp_{i}"
            )

        # 11th participation from same IP should be blocked
        path_parts = ["api", "giveaways", str(giveaway["id"]), "participate"]
        body = {"username": "rateuser_blocked", "email": "blocked@test.com"}
        headers = {"X-Forwarded-For": "192.168.1.100"}

        status, data = routes.route_request("POST", path_parts, body, headers=headers)
        self.assertEqual(status, 429)
        self.assertIn("Trop de participations", data["error"])

    def test_multi_account_detection(self):
        """Test that multi-account detection blocks after 5+ distinct users with same fingerprint."""
        # Create multiple giveaways and participate with different users but same fingerprint
        for i in range(5):
            giveaway = database.create_giveaway({
                "title": f"Multi Account Test {i}",
                "price": 5.0,
            })
            user = database.get_or_create_user(f"multiuser{i}", f"multi{i}@test.com")
            database.record_participation_fingerprint(
                giveaway["id"], user["id"], f"10.0.0.{i}", "shared_fingerprint_xyz"
            )

        # Next participation with same fingerprint should be blocked
        new_giveaway = database.create_giveaway({
            "title": "Multi Account Block Test",
            "price": 5.0,
        })
        path_parts = ["api", "giveaways", str(new_giveaway["id"]), "participate"]
        body = {"username": "multiuser_blocked", "email": "multiblocked@test.com",
                "fingerprint": "shared_fingerprint_xyz"}

        status, data = routes.route_request("POST", path_parts, body)
        self.assertEqual(status, 400)
        self.assertIn("suspecte", data["error"])

    def test_rate_limiting_allows_normal_usage(self):
        """Test that rate limiting allows fewer than 10 participations."""
        # Record 5 fingerprints from the same IP in various giveaways
        for i in range(5):
            giveaway = database.create_giveaway({
                "title": f"Normal Rate Giveaway {i}",
                "price": 5.0,
            })
            user = database.get_or_create_user(f"normaluser{i}", f"normal{i}@test.com")
            database.record_participation_fingerprint(
                giveaway["id"], user["id"], "10.20.30.40", f"normalfp_{i}"
            )

        # Create a fresh giveaway for the next participation
        new_giveaway = database.create_giveaway({
            "title": "Normal Rate Final",
            "price": 5.0,
        })

        # Next participation from same IP should still succeed
        path_parts = ["api", "giveaways", str(new_giveaway["id"]), "participate"]
        body = {"username": "normaluser_ok", "email": "normalok@test.com"}
        headers = {"X-Forwarded-For": "10.20.30.40"}

        status, data = routes.route_request("POST", path_parts, body, headers=headers)
        self.assertEqual(status, 201)


if __name__ == "__main__":
    unittest.main()
