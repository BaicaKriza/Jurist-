"""
Seed script — krijon superadmin user dhe rolet bazë nëse nuk ekzistojnë.
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

        # --- Superadmin user ---
        admin_email = "admin@jurist.al"
        existing = db.query(User).filter(User.email == admin_email).first()
        if not existing:
            admin = User(
                id=str(uuid.uuid4()),
                full_name="Administrator",
                email=admin_email,
                password_hash=hash_password("Admin123!"),
                is_active=True,
                is_superadmin=True,
            )
            db.add(admin)
            db.flush()
            db.add(UserRole(id=str(uuid.uuid4()), user_id=admin.id, role_id=roles["admin"].id))
            print(f"  ✓ Superadmin krijuar: {admin_email} / Admin123!")
        else:
            print(f"  · Superadmin ekziston: {admin_email}")

        db.commit()
        print("\n✅ Seed u kompletua me sukses!")
        print("\n  Kredencialet e hyrjes:")
        print("  Email   : admin@jurist.al")
        print("  Password: Admin123!\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Gabim: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
