"""
Bootstrap script: creates default roles and the superadmin user.
Run once after the database is ready:

    python seed.py

Environment variables (with defaults):
    ADMIN_EMAIL          = admin@jurist.al
    ADMIN_PASSWORD       = Admin123!
    ADMIN_FULL_NAME      = Administrator
    RESET_ADMIN_PASSWORD = false (set true locally to repair test login)
    DATABASE_URL         = (from .env / environment)
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── allow running from project root or backend/ ────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))


def run_seed() -> None:
    from app.core.config import settings
    from app.core.database import SessionLocal, Base, engine
    from app.models import user, role, company, folder, document, procedure, analysis, matching, audit_log  # noqa: F401
    from app.models.user import User
    from app.models.role import Role, UserRole
    from app.core.security import hash_password
    from sqlalchemy import select

    # ── create tables ──────────────────────────────────────────────────────
    logger.info("Creating / verifying database tables…")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── seed roles ─────────────────────────────────────────────────────
        default_roles = [
            ("admin", "Administrator me akses të plotë"),
            ("manager", "Menaxher me akses ndaj kompanive dhe dokumenteve"),
            ("viewer", "Lexues vetëm-shikues"),
            ("operator", "Operator me akses ndaj dokumenteve"),
        ]
        for role_name, description in default_roles:
            existing = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
            if not existing:
                db.add(Role(name=role_name, description=description))
                logger.info(f"  + role '{role_name}' created")
            else:
                logger.info(f"  ~ role '{role_name}' already exists – skipped")
        db.commit()

        # ── seed superadmin ────────────────────────────────────────────────
        admin_email = os.getenv("ADMIN_EMAIL", "admin@jurist.al")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin123!")
        admin_full_name = os.getenv("ADMIN_FULL_NAME", "Administrator")

        reset_admin_password = os.getenv("RESET_ADMIN_PASSWORD", "").lower() in {"1", "true", "yes", "on"}
        existing_admin = db.execute(select(User).where(User.email == admin_email)).scalar_one_or_none()
        admin_role = db.execute(select(Role).where(Role.name == "admin")).scalar_one_or_none()

        if existing_admin:
            updated = False
            if reset_admin_password and settings.ENVIRONMENT != "production":
                existing_admin.password_hash = hash_password(admin_password)
                existing_admin.full_name = admin_full_name
                existing_admin.is_active = True
                existing_admin.is_superadmin = True
                updated = True
                logger.info(f"  ~ superadmin '{admin_email}' password reset for local testing")
            elif reset_admin_password:
                logger.warning("  ! RESET_ADMIN_PASSWORD ignored in production")

            if admin_role:
                existing_link = db.execute(
                    select(UserRole).where(
                        UserRole.user_id == existing_admin.id,
                        UserRole.role_id == admin_role.id,
                    )
                ).scalar_one_or_none()
                if not existing_link:
                    db.add(UserRole(user_id=existing_admin.id, role_id=admin_role.id))
                    updated = True
                    logger.info(f"  + admin role linked to '{admin_email}'")

            if updated:
                db.commit()
            else:
                logger.info(f"  ~ superadmin '{admin_email}' already exists - skipped")
        else:
            admin_user = User(
                full_name=admin_full_name,
                email=admin_email,
                password_hash=hash_password(admin_password),
                is_active=True,
                is_superadmin=True,
            )
            db.add(admin_user)
            db.flush()

            # Assign admin role
            if admin_role:
                db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))

            db.commit()
            logger.info(f"  + superadmin '{admin_email}' created (password: {admin_password})")

        logger.info("Seed completed successfully.")

    except Exception as exc:
        db.rollback()
        logger.error(f"Seed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
