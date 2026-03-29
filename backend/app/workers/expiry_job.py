"""
Expiry automation job.

Runs once on startup and then every day at 01:00 (server local time).
Marks any ACTIVE document whose expiry_date < today as EXPIRED.
Also marks REVIEW_REQUIRED documents that are past expiry as EXPIRED.
"""

import logging
from datetime import date

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.document import Document, DocumentStatus

logger = logging.getLogger(__name__)


def run_expiry_check() -> dict:
    """
    Scan all documents and update statuses:
      - ACTIVE / REVIEW_REQUIRED  +  expiry_date < today  →  EXPIRED
      - EXPIRED  +  expiry_date >= today                  →  ACTIVE  (un-expire if date was corrected)

    Returns a summary dict for logging.
    """
    today = date.today()
    newly_expired: list[str] = []
    newly_restored: list[str] = []

    db: Session = SessionLocal()
    try:
        # --- expire overdue documents ---
        overdue = db.execute(
            select(Document).where(
                and_(
                    Document.expiry_date < today,
                    Document.expiry_date.is_not(None),
                    or_(
                        Document.status == DocumentStatus.ACTIVE,
                        Document.status == DocumentStatus.REVIEW_REQUIRED,
                    ),
                )
            )
        ).scalars().all()

        for doc in overdue:
            doc.status = DocumentStatus.EXPIRED
            newly_expired.append(doc.id)

        # --- restore incorrectly expired documents (date was updated to future) ---
        wrongly_expired = db.execute(
            select(Document).where(
                and_(
                    Document.expiry_date >= today,
                    Document.expiry_date.is_not(None),
                    Document.status == DocumentStatus.EXPIRED,
                )
            )
        ).scalars().all()

        for doc in wrongly_expired:
            doc.status = DocumentStatus.ACTIVE
            newly_restored.append(doc.id)

        db.commit()

    except Exception as e:
        logger.error(f"[expiry_job] Error during expiry check: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    summary = {
        "date": today.isoformat(),
        "newly_expired": len(newly_expired),
        "newly_restored": len(newly_restored),
    }
    if newly_expired or newly_restored:
        logger.info(
            f"[expiry_job] {summary['newly_expired']} expired, "
            f"{summary['newly_restored']} restored on {today}"
        )
    else:
        logger.debug(f"[expiry_job] No status changes on {today}")

    return summary


def start_scheduler():
    """Start APScheduler with the expiry job. Call once at app startup."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = BackgroundScheduler(timezone="Europe/Tirane")

        # Run at 01:00 AM every day
        scheduler.add_job(
            run_expiry_check,
            trigger=CronTrigger(hour=1, minute=0),
            id="document_expiry_check",
            name="Document expiry check",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        scheduler.start()
        logger.info("[expiry_job] Scheduler started – daily expiry check at 01:00 (Europe/Tirane)")

        # Also run once immediately on startup to catch any backlog
        run_expiry_check()

        return scheduler

    except Exception as e:
        logger.error(f"[expiry_job] Failed to start scheduler: {e}")
        return None
