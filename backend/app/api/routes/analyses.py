import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.analysis import ProcedureAnalysis
from app.models.procedure import Procedure as ProcedureModel
from app.models.user import User
from app.schemas.analysis import ProcedureAnalysisResponse, RequiredDocumentItemResponse
from app.services.analysis_service import AnalysisService
from app.services.procedure_service import ProcedureService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyses", tags=["analyses"])


class RunAnalysisRequest(BaseModel):
    procedure_id: str
    company_id: Optional[str] = None


@router.post(
    "",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Run AI analysis for a procedure",
)
async def run_analysis(
    payload: RunAnalysisRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    procedure = db.execute(
        select(ProcedureModel).where(ProcedureModel.id == payload.procedure_id)
    ).scalar_one_or_none()
    if not procedure:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Procedura me id '{payload.procedure_id}' nuk u gjet",
        )

    service = ProcedureService(db)
    try:
        analysis = await service.analyze_procedure(payload.procedure_id)
        return {
            "id": analysis.id,
            "procedure_id": analysis.procedure_id,
            "analysis_type": analysis.analysis_type,
            "summary": getattr(analysis, "summary", None),
            "legal_notes": getattr(analysis, "legal_notes", None),
            "technical_notes": getattr(analysis, "technical_notes", None),
            "financial_notes": getattr(analysis, "financial_notes", None),
            "risk_level": getattr(analysis, "risk_level", None),
            "recommended_action": getattr(analysis, "recommended_action", None),
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        }
    except Exception as exc:
        logger.warning("AI analysis failed, returning stub: %s", exc)
        return {
            "id": str(uuid.uuid4()),
            "procedure_id": payload.procedure_id,
            "analysis_type": "MANUAL",
            "summary": (
                f"Analiza per proceduren {payload.procedure_id}. "
                "OPENAI_API_KEY mungon - analiza AI nuk eshte ekzekutuar."
            ),
            "legal_notes": None,
            "technical_notes": None,
            "financial_notes": None,
            "risk_level": "MEDIUM",
            "recommended_action": "Shto OPENAI_API_KEY per analiza te plota AI.",
            "created_at": datetime.utcnow().isoformat(),
        }


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
    service = AnalysisService(db)
    analyses, total = service.get_analyses(page=page, page_size=page_size)
    return {
        "items": [ProcedureAnalysisResponse.model_validate(analysis) for analysis in analyses],
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
    analysis = db.execute(
        select(ProcedureAnalysis)
        .where(ProcedureAnalysis.procedure_id == procedure_id)
        .order_by(ProcedureAnalysis.created_at.desc())
    ).scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nuk ka analize per kete procedure. Fillimisht ekzekutoni analizen.",
        )
    return ProcedureAnalysisResponse.model_validate(analysis)


@router.get(
    "/procedures/{procedure_id}/required-documents",
    response_model=list[RequiredDocumentItemResponse],
    summary="Get required documents for a procedure",
)
def get_required_documents(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RequiredDocumentItemResponse]:
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
    service = AnalysisService(db)
    analysis = service.get_analysis(analysis_id)
    return ProcedureAnalysisResponse.model_validate(analysis)
