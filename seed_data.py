"""Seed script to populate the database with sample data."""

import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))
import database


def seed():
    """Populate the database with sample data."""
    # Remove existing database to start fresh
    if database.DB_PATH.exists():
        database.DB_PATH.unlink()

    database.init_db()

    # Create sample giveaways
    now = datetime.utcnow()

    giveaways_data = [
        {
            "title": "Clavier Gaming Mecanique RGB",
            "description": "Clavier mecanique gaming avec switches Cherry MX Red, retroeclairage RGB 16.8M couleurs, repose-poignet magnetique detachable.",
            "image_url": "/static/images/keyboard.svg",
            "price": 59.99,
            "source_url": "https://www.amazon.fr/dp/B09XYZ1234",
            "condition": "Neuf - Scelle",
            "max_participants": 100,
            "end_time": (now + timedelta(hours=48)).isoformat(),
        },
        {
            "title": "Casque Gaming Sans Fil 7.1",
            "description": "Casque gaming sans fil avec son surround 7.1, micro anti-bruit detachable, autonomie 30h, compatible PC/PS5/Xbox.",
            "image_url": "/static/images/headset.svg",
            "price": 79.99,
            "source_url": "https://www.amazon.fr/dp/B09ABC5678",
            "condition": "Neuf - Scelle",
            "max_participants": 80,
            "end_time": (now + timedelta(hours=72)).isoformat(),
        },
        {
            "title": "Souris Gaming 16000 DPI",
            "description": "Souris gaming ultra-legere 63g, capteur optique 16000 DPI, 6 boutons programmables, cable paracord.",
            "image_url": "/static/images/mouse.svg",
            "price": 49.99,
            "source_url": "https://www.amazon.fr/dp/B09DEF9012",
            "condition": "Neuf - Scelle",
            "max_participants": 120,
            "end_time": (now + timedelta(hours=24)).isoformat(),
        },
        {
            "title": "Webcam 4K Ultra HD",
            "description": "Webcam 4K 30fps / 1080p 60fps, autofocus, correction de lumiere, double micro stereo, compatible streaming.",
            "image_url": "/static/images/webcam.svg",
            "price": 89.99,
            "source_url": "https://www.amazon.fr/dp/B09GHI3456",
            "condition": "Neuf - Scelle",
            "max_participants": 60,
            "end_time": (now + timedelta(hours=36)).isoformat(),
        },
        {
            "title": "SSD 1TB NVMe PCIe 4.0",
            "description": "SSD NVMe M.2 2280, vitesse lecture 7000 Mo/s, ecriture 5500 Mo/s, ideal gaming et creation de contenu.",
            "image_url": "/static/images/ssd.svg",
            "price": 69.99,
            "source_url": "https://www.amazon.fr/dp/B09JKL7890",
            "condition": "Neuf - Scelle",
            "max_participants": 90,
            "end_time": (now + timedelta(hours=60)).isoformat(),
        },
        {
            "title": "Manette PS5 DualSense",
            "description": "Manette sans fil DualSense pour PS5, retour haptique, gachettes adaptatives, micro integre, coloris Cosmic Red.",
            "image_url": "/static/images/controller.svg",
            "price": 54.99,
            "source_url": "https://www.amazon.fr/dp/B09MNO1234",
            "condition": "Neuf - Scelle",
            "max_participants": 150,
            "end_time": (now + timedelta(hours=42)).isoformat(),
        },
    ]

    for data in giveaways_data:
        database.create_giveaway(data)

    # Create sample users
    user1 = database.get_or_create_user("GamerDuNord", "gamer.nord@email.fr")
    user2 = database.get_or_create_user("TechPassion33", "tech33@email.fr")
    user3 = database.get_or_create_user("StreamerPro_", "streamer@email.fr")

    # Create an ended giveaway with a winner
    ended_giveaway = database.create_giveaway({
        "title": "Casque Audio Pro Studio",
        "description": "Casque audio professionnel pour studio, reduction de bruit active, Bluetooth 5.2.",
        "image_url": "/static/images/headset.svg",
        "price": 129.99,
        "source_url": "https://www.amazon.fr/dp/B09PQR5678",
        "condition": "Neuf - Scelle",
        "max_participants": 50,
        "end_time": (now - timedelta(hours=12)).isoformat(),
        "status": "active",
    })

    # Add participants and draw winner for the ended giveaway
    database.create_ticket(user1["id"], ended_giveaway["id"])
    database.create_ticket(user2["id"], ended_giveaway["id"])
    database.create_ticket(user3["id"], ended_giveaway["id"])

    winner = database.draw_winner(ended_giveaway["id"])
    if winner:
        database.update_shipping(winner["id"], "shipped", "https://i.imgur.com/proof123.jpg")

    # Create another ended giveaway
    ended_giveaway2 = database.create_giveaway({
        "title": "Tapis de Souris XXL RGB",
        "description": "Tapis de souris gaming XXL 900x400mm, base antiderapante, eclairage RGB peripherique.",
        "image_url": "/static/images/mousepad.svg",
        "price": 34.99,
        "source_url": "https://www.amazon.fr/dp/B09STU9012",
        "condition": "Neuf - Scelle",
        "max_participants": 200,
        "end_time": (now - timedelta(hours=48)).isoformat(),
        "status": "active",
    })

    database.create_ticket(user1["id"], ended_giveaway2["id"])
    database.create_ticket(user3["id"], ended_giveaway2["id"])

    winner2 = database.draw_winner(ended_giveaway2["id"])
    if winner2:
        database.update_shipping(winner2["id"], "delivered", "https://i.imgur.com/proof456.jpg")

    # Add some participants to active giveaways
    database.create_ticket(user1["id"], 1)
    database.create_ticket(user2["id"], 1)
    database.create_ticket(user3["id"], 2)

    print("Database seeded successfully!")
    print(f"  - {len(giveaways_data) + 2} giveaways created")
    print(f"  - 3 users created")
    print(f"  - Multiple tickets created")
    print(f"  - 2 winners drawn")


if __name__ == "__main__":
    seed()
