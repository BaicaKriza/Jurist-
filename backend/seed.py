"""
Seed script — krijon rolet bazë dhe superadmin nëse nuk ekzistojnë.
Email/password merren nga env vars BOOTSTRAP_EMAIL / BOOTSTRAP_PASSWORD,
ose defaultet: admin@jurist.al / Admin123!

Ekzekuto: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, create_tables
from app.models.user import User
from app.models.role import Role, UserRole
from app.core.security import hash_password
import uuid


BOOTSTRAP_EMAIL = os.getenv("BOOTSTRAP_EMAIL", "admin@jurist.al")
BOOTSTRAP_PASSWORD = os.getenv("BOOTSTRAP_PASSWORD", "Admin123!")
BOOTSTRAP_NAME = os.getenv("BOOTSTRAP_NAME", "Administrator")


def seed():
    print("Inicializo databazën...")
    create_tables()
    db = SessionLocal()

    try:
        # --- Roles ---
        role_defs = [
            ("admin", "Administratori i sistemit"),
            ("manager", "Menaxher dokumentesh"),
            ("viewer", "Vetëm lexim"),
        ]
        roles = {}
        for name, desc in role_defs:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(id=str(uuid.uuid4()), name=name, description=desc)
                db.add(role)
                print(f"  ✓ Rol i krijuar: {name}")
            else:
                print(f"  · Rol ekziston: {name}")
            roles[name] = role
        db.flush()

        # --- Bootstrap superadmin ---
        existing = db.query(User).filter(User.email == BOOTSTRAP_EMAIL).first()
        if not existing:
            admin = User(
                id=str(uuid.uuid4()),
                full_name=BOOTSTRAP_NAME,
                email=BOOTSTRAP_EMAIL,
                password_hash=hash_password(BOOTSTRAP_PASSWORD),
                is_active=True,
                is_superadmin=True,
            )
            db.add(admin)
            db.flush()
            db.add(UserRole(id=str(uuid.uuid4()), user_id=admin.id, role_id=roles["admin"].id))
            print(f"  ✓ Superadmin krijuar: {BOOTSTRAP_EMAIL}")
        else:
            print(f"  · Superadmin ekziston: {BOOTSTRAP_EMAIL}")

        db.commit()
        print("\n✅ Seed u kompletua me sukses!")
        print(f"\n  Email   : {BOOTSTRAP_EMAIL}")
        print(f"  Password: {BOOTSTRAP_PASSWORD}\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Gabim: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
