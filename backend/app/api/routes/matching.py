import logging
from typing import List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.analysis import (
    MatchingReportResponse,
    MatchingResultResponse,
    RetrievalGuideCreate,
    RetrievalGuideResponse,
)
from app.services.matching_service import MatchingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matching", tags=["matching"])


class RunMatchingRequest(BaseModel):
    procedure_id: str
    company_id: str


@router.post(
    "/run",
    response_model=List[MatchingResultResponse],
    summary="Run document matching for a procedure and company",
)
def run_matching(
    payload: RunMatchingRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[MatchingResultResponse]:
    """
    Execute the document matching algorithm: compare the required documents from a
    procedure analysis against the company's document vault and return per-item results.
    """
    service = MatchingService(db)
    results = service.run_matching(
        procedure_id=payload.procedure_id,
        company_id=payload.company_id,
    )
    logger.info(
        f"Matching run for procedure {payload.procedure_id} / company {payload.company_id}: "
        f"{len(results)} results"
    )

    # Enrich results with required document and matched document names
    from sqlalchemy import select
    from app.models.analysis import RequiredDocumentItem
    from app.models.document import Document

    enriched = []
    for r in results:
        req_doc = db.execute(
            select(RequiredDocumentItem).where(RequiredDocumentItem.id == r.required_document_item_id)
        ).scalar_one_or_none()

        matched_doc = None
        if r.matched_document_id:
            matched_doc = db.execute(
                select(Document).where(Document.id == r.matched_document_id)
            ).scalar_one_or_none()

        enriched.append(
            MatchingResultResponse(
                id=r.id,
                procedure_id=r.procedure_id,
                company_id=r.company_id,
                required_document_item_id=r.required_document_item_id,
                matched_document_id=r.matched_document_id,
                match_status=r.match_status,
                confidence_score=r.confidence_score,
                notes=r.notes,
                created_at=r.created_at,
                required_document_name=req_doc.name if req_doc else None,
                required_document_category=req_doc.category if req_doc else None,
                matched_document_title=matched_doc.title if matched_doc else None,
            )
        )
    return enriched


@router.get(
    "/report/{procedure_id}/{company_id}",
    response_model=MatchingReportResponse,
    summary="Get a full matching report",
)
def get_matching_report(
    procedure_id: str,
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MatchingReportResponse:
    """
    Generate and return a comprehensive readiness report showing which required documents
    are present, expired, partially matched, or missing for a company/procedure combination.
    """
    service = MatchingService(db)
    return service.generate_report(procedure_id=procedure_id, company_id=company_id)


@router.get(
    "/retrieval-guides",
    response_model=List[RetrievalGuideResponse],
    summary="List retrieval guides",
)
def list_retrieval_guides(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[RetrievalGuideResponse]:
    """Return all active retrieval guides that describe how to obtain specific document types."""
    service = MatchingService(db)
    guides = service.list_retrieval_guides(active_only=True)
    return [RetrievalGuideResponse.model_validate(g) for g in guides]


@router.post(
    "/retrieval-guides",
    response_model=RetrievalGuideResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a retrieval guide",
)
def create_retrieval_guide(
    payload: RetrievalGuideCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RetrievalGuideResponse:
    """Create a new retrieval guide that explains how to obtain a specific type of document."""
    service = MatchingService(db)
    guide = service.create_retrieval_guide(payload)
    logger.info(f"Retrieval guide created for document type: {guide.document_type}")
    return RetrievalGuideResponse.model_validate(guide)
