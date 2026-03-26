import logging
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.analysis import ProcedureAnalysisResponse, RequiredDocumentItemResponse
from app.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.get(
    "",
    response_model=dict,
    summary="List all procedure analyses",
)
def list_analyses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return a paginated list of all AI-generated procedure analyses, newest first."""
    service = AnalysisService(db)
    analyses, total = service.get_analyses(page=page, page_size=page_size)
    return {
        "items": [ProcedureAnalysisResponse.model_validate(a) for a in analyses],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get(
    "/procedures/{procedure_id}/analysis",
    response_model=ProcedureAnalysisResponse,
    summary="Get the analysis for a specific procedure",
)
def get_analysis_for_procedure(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProcedureAnalysisResponse:
    """Return the most recent AI analysis for the given procedure."""
    from sqlalchemy import select
    from app.models.analysis import ProcedureAnalysis
    from fastapi import HTTPException, status as http_status

    analysis = db.execute(
        select(ProcedureAnalysis)
        .where(ProcedureAnalysis.procedure_id == procedure_id)
        .order_by(ProcedureAnalysis.created_at.desc())
    ).scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Nuk ka analizë për këtë procedurë. Fillimisht ekzekutoni analizën.",
        )
    return ProcedureAnalysisResponse.model_validate(analysis)


@router.get(
    "/procedures/{procedure_id}/required-documents",
    response_model=List[RequiredDocumentItemResponse],
    summary="Get required documents for a procedure",
)
def get_required_documents(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[RequiredDocumentItemResponse]:
    """Return the list of required document items extracted from the AI analysis of a procedure."""
    service = AnalysisService(db)
    items = service.get_required_documents(procedure_id)
    return [RequiredDocumentItemResponse.model_validate(item) for item in items]


@router.get(
    "/{analysis_id}",
    response_model=ProcedureAnalysisResponse,
    summary="Get an analysis by ID",
)
def get_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProcedureAnalysisResponse:
    """Retrieve the full details of a single AI-generated procedure analysis."""
    service = AnalysisService(db)
    analysis = service.get_analysis(analysis_id)
    return ProcedureAnalysisResponse.model_validate(analysis)
