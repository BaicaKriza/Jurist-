import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.procedure import (
    ProcedureResponse,
    ProcedureDocumentResponse,
    SyncRequest,
    ProcedureSyncResponse,
)
from app.services.procedure_service import ProcedureService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/procedures", tags=["procedures"])


@router.get(
    "",
    response_model=dict,
    summary="List procurement procedures",
)
def list_procedures(
    source_name: Optional[str] = Query(None, description="Filter by source (CONTRACT_NOTICE / SMALL_VALUE)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by procedure status"),
    authority_name: Optional[str] = Query(None, description="Filter by contracting authority (partial match)"),
    search: Optional[str] = Query(None, description="Search in description, authority or reference"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return a paginated list of procurement procedures with optional filters."""
    service = ProcedureService(db)
    procedures, total = service.get_procedures(
        source_name=source_name,
        status_filter=status_filter,
        authority_name=authority_name,
        search=search,
        page=page,
        page_size=page_size,
    )

    items = []
    for proc in procedures:
        doc_count = service.get_procedure_doc_count(proc.id)
        items.append(
            ProcedureResponse(
                id=proc.id,
                source_name=proc.source_name,
                source_url=proc.source_url,
                reference_no=proc.reference_no,
                notice_no=proc.notice_no,
                authority_name=proc.authority_name,
                object_description=proc.object_description,
                procedure_type=proc.procedure_type,
                contract_type=proc.contract_type,
                cpv_code=proc.cpv_code,
                fund_limit=float(proc.fund_limit) if proc.fund_limit is not None else None,
                currency=proc.currency,
                publication_date=proc.publication_date,
                opening_date=proc.opening_date,
                closing_date=proc.closing_date,
                status=proc.status,
                created_at=proc.created_at,
                updated_at=proc.updated_at,
                document_count=doc_count,
            )
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get(
    "/{procedure_id}",
    response_model=ProcedureResponse,
    summary="Get a procedure by ID",
)
def get_procedure(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProcedureResponse:
    """Retrieve full details of a single procurement procedure including its document count."""
    service = ProcedureService(db)
    proc = service.get_procedure(procedure_id)
    doc_count = service.get_procedure_doc_count(procedure_id)
    return ProcedureResponse(
        id=proc.id,
        source_name=proc.source_name,
        source_url=proc.source_url,
        reference_no=proc.reference_no,
        notice_no=proc.notice_no,
        authority_name=proc.authority_name,
        object_description=proc.object_description,
        procedure_type=proc.procedure_type,
        contract_type=proc.contract_type,
        cpv_code=proc.cpv_code,
        fund_limit=float(proc.fund_limit) if proc.fund_limit is not None else None,
        currency=proc.currency,
        publication_date=proc.publication_date,
        opening_date=proc.opening_date,
        closing_date=proc.closing_date,
        status=proc.status,
        created_at=proc.created_at,
        updated_at=proc.updated_at,
        document_count=doc_count,
    )


@router.post(
    "/sync",
    response_model=ProcedureSyncResponse,
    summary="Sync procedures from APP portal",
)
async def sync_procedures(
    payload: SyncRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProcedureSyncResponse:
    """Trigger a crawl and sync of procurement procedures from app.gov.al."""
    service = ProcedureService(db)
    result = await service.sync_from_app(payload)
    logger.info(f"Sync completed: {result}")
    return result


@router.post(
    "/{procedure_id}/analyze",
    response_model=dict,
    summary="Analyze a procedure with AI",
)
async def analyze_procedure(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Trigger an AI analysis of a procedure to extract required documents and risk assessment."""
    service = ProcedureService(db)
    analysis = await service.analyze_procedure(procedure_id)
    logger.info(f"Analysis triggered for procedure {procedure_id}")
    return {
        "id": analysis.id,
        "procedure_id": analysis.procedure_id,
        "analysis_type": analysis.analysis_type,
        "summary": analysis.summary,
        "legal_notes": analysis.legal_notes,
        "technical_notes": analysis.technical_notes,
        "financial_notes": analysis.financial_notes,
        "risk_level": analysis.risk_level,
        "recommended_action": analysis.recommended_action,
        "created_at": analysis.created_at.isoformat(),
    }


@router.post(
    "/{procedure_id}/download-documents",
    response_model=dict,
    summary="Download all documents linked to a procedure",
)
async def download_procedure_documents(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Fetch and store all external documents associated with a procurement procedure."""
    service = ProcedureService(db)
    result = await service.download_procedure_documents(procedure_id)
    logger.info(f"Documents downloaded for procedure {procedure_id}")
    return result


@router.get(
    "/{procedure_id}/documents",
    response_model=List[ProcedureDocumentResponse],
    summary="Get documents attached to a procedure",
)
def get_procedure_documents(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[ProcedureDocumentResponse]:
    """Return all documents (tender dossier files) linked to a procurement procedure."""
    service = ProcedureService(db)
    docs = service.get_procedure_documents(procedure_id)
    return [ProcedureDocumentResponse.model_validate(d) for d in docs]
