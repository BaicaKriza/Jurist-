import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.company import Company
from app.models.document import Document, DocumentStatus
from app.models.procedure import Procedure
from app.models.analysis import ProcedureAnalysis
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", summary="Get dashboard statistics")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return aggregated stats and recent items for the dashboard."""

    today = date.today()
    thirty_days = today + timedelta(days=30)

    # Active companies
    active_companies = db.execute(
        select(func.count(Company.id)).where(Company.is_active == True)
    ).scalar() or 0

    # Total documents
    total_documents = db.execute(
        select(func.count(Document.id))
    ).scalar() or 0

    # Documents expiring within 30 days (not yet expired)
    expiring_soon = db.execute(
        select(func.count(Document.id)).where(
            Document.expiry_date != None,
            Document.expiry_date >= today,
            Document.expiry_date <= thirty_days,
        )
    ).scalar() or 0

    # Expired documents
    expired_documents = db.execute(
        select(func.count(Document.id)).where(
            Document.expiry_date != None,
            Document.expiry_date < today,
        )
    ).scalar() or 0

    # New procedures today
    new_procedures_today = db.execute(
        select(func.count(Procedure.id)).where(
            func.date(Procedure.created_at) == today
        )
    ).scalar() or 0

    # Pending analyses (procedures without a completed analysis)
    analyzed_ids = select(ProcedureAnalysis.procedure_id)
    pending_analyses = db.execute(
        select(func.count(Procedure.id)).where(
            ~Procedure.id.in_(analyzed_ids)
        )
    ).scalar() or 0

    # Recent expiring documents
    recent_expiring_docs = db.execute(
        select(Document)
        .where(
            Document.expiry_date != None,
            Document.expiry_date >= today,
            Document.expiry_date <= thirty_days,
        )
        .order_by(Document.expiry_date.asc())
        .limit(6)
    ).scalars().all()

    # Recent procedures
    recent_procedures = db.execute(
        select(Procedure)
        .order_by(Procedure.created_at.desc())
        .limit(6)
    ).scalars().all()

    def doc_to_dict(d: Document) -> dict:
        status = "valid"
        if d.expiry_date:
            if d.expiry_date < today:
                status = "expired"
            elif d.expiry_date <= thirty_days:
                status = "expiring_soon"
        return {
            "id": str(d.id),
            "title": d.title,
            "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
            "status": status,
            "document_type": d.doc_type or "other",
        }

    def proc_to_dict(p: Procedure) -> dict:
        return {
            "id": str(p.id),
            "title": p.object_description or "Pa titull",
            "contracting_authority": p.authority_name or "",
            "status": p.status or "open",
            "reference_number": p.reference_no or "",
            "analysis_status": "pending",
        }

    return {
        "active_companies": active_companies,
        "total_documents": total_documents,
        "expiring_soon": expiring_soon,
        "new_procedures_today": new_procedures_today,
        "expired_documents": expired_documents,
        "pending_analyses": pending_analyses,
        "recent_expiring_documents": [doc_to_dict(d) for d in recent_expiring_docs],
        "recent_procedures": [proc_to_dict(p) for p in recent_procedures],
    }
