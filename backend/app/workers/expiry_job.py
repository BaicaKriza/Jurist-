"""
Expiry automation job + APP.gov.al auto-sync.

- Expiry check: runs on startup and daily at 01:00 (Europe/Tirane)
- Procedure sync: runs on startup and every 6 hours automatically
"""

import asyncio
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


def run_auto_sync() -> None:
    """Run APP.gov.al procedure sync (called from background scheduler thread)."""
    db: Session = SessionLocal()
    try:
        from app.integrations.app_gov.sync_service import AppGovSyncService
        service = AppGovSyncService(db)
        result = asyncio.run(service.run_full_sync(max_pages=3))
        logger.info(
            f"[auto_sync] APP.gov.al sync complete – "
            f"new: {result.synced}, updated: {result.updated}, errors: {result.errors}"
        )
    except Exception as e:
        logger.error(f"[auto_sync] Sync failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start APScheduler with expiry + auto-sync jobs. Call once at app startup."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler(timezone="Europe/Tirane")

        # Daily expiry check at 01:00 AM
        scheduler.add_job(
            run_expiry_check,
            trigger=CronTrigger(hour=1, minute=0),
            id="document_expiry_check",
            name="Document expiry check",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # APP.gov.al auto-sync every 6 hours
        scheduler.add_job(
            run_auto_sync,
            trigger=IntervalTrigger(hours=6),
            id="app_gov_auto_sync",
            name="APP.gov.al procedure auto-sync",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        scheduler.start()
        logger.info("[expiry_job] Scheduler started – expiry check daily at 01:00, sync every 6h")

        # Run both once on startup
        run_expiry_check()
        run_auto_sync()

        return scheduler

    except Exception as e:
        logger.error(f"[expiry_job] Failed to start scheduler: {e}")
        return None
