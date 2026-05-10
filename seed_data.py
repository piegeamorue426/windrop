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

    print("Database seeded successfully!")
    print(f"  - {len(giveaways_data)} giveaways created")
    print(f"  - 0 fake users")
    print(f"  - 0 fake participants")
    print(f"  - 0 fake winners")


if __name__ == "__main__":
    seed()
