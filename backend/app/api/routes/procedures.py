import hashlib
import logging
import os
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.procedure import (
    ProcedureResponse,
    ProcedureCreate,
    ProcedureDocumentResponse,
    SyncRequest,
    ProcedureSyncResponse,
    RequiredDocumentCreate,
    RequiredDocumentResponse,
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
    from app.core.storage import get_file_url
    service = ProcedureService(db)
    docs = service.get_procedure_documents(procedure_id)
    result = []
    for d in docs:
        resp = ProcedureDocumentResponse.model_validate(d)
        resp.is_uploaded = d.file_path is not None
        if d.file_path:
            try:
                resp.download_url = get_file_url(d.file_path)
            except Exception:
                pass
        result.append(resp)
    return result


@router.post(
    "/{procedure_id}/upload-file",
    response_model=ProcedureDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file to a procedure with AI analysis",
)
async def upload_procedure_file(
    procedure_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcedureDocumentResponse:
    """Upload a document file to a procedure. Text is extracted and an AI summary is generated."""
    from app.models.procedure import ProcedureDocument as ProcedureDocumentModel, Procedure as ProcedureModel
    from app.core.storage import upload_file, get_file_url
    from app.utils.text_extract import TextExtractor
    from app.services.analysis_service import AnalysisService
    from sqlalchemy import select

    # Verify procedure exists
    proc = db.execute(
        select(ProcedureModel).where(ProcedureModel.id == procedure_id)
    ).scalar_one_or_none()
    if not proc:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedura nuk u gjet")

    # Read file
    file_content = await file.read()
    file_ext = Path(file.filename or "doc").suffix.lower()
    checksum = hashlib.sha256(file_content).hexdigest()
    object_name = f"procedures/{procedure_id}/{checksum}{file_ext}"
    mime_type = file.content_type or "application/octet-stream"

    # Store file
    upload_file(file_content, object_name, content_type=mime_type)

    # Extract text
    extracted_text = None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        extracted_text = TextExtractor().extract(tmp_path, mime_type)
    except Exception as e:
        logger.warning(f"Text extraction failed for procedure doc: {e}")
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    # AI summary
    ai_summary = None
    if extracted_text:
        try:
            ai_summary = AnalysisService(db).generate_summary(extracted_text)
        except Exception as e:
            logger.warning(f"AI summary failed for procedure doc: {e}")

    doc = ProcedureDocumentModel(
        procedure_id=procedure_id,
        title=title or file.filename or "Dokument",
        file_name=file.filename,
        file_path=object_name,
        mime_type=mime_type,
        checksum=checksum,
        extracted_text=extracted_text,
        ai_summary=ai_summary,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    logger.info(f"File '{file.filename}' uploaded to procedure {procedure_id}")

    resp = ProcedureDocumentResponse.model_validate(doc)
    resp.is_uploaded = True
    try:
        resp.download_url = get_file_url(object_name)
    except Exception:
        pass
    return resp


# ---------------------------------------------------------------------------
# Manual procedure creation
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=ProcedureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create a procedure",
)
def create_procedure(
    payload: ProcedureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcedureResponse:
    """Create a procurement procedure manually (without syncing from app.gov.al)."""
    from app.models.procedure import Procedure as ProcedureModel
    from sqlalchemy import select

    # Check for duplicate reference_no if provided
    if payload.reference_no:
        existing = db.execute(
            select(ProcedureModel).where(ProcedureModel.reference_no == payload.reference_no)
        ).scalar_one_or_none()
        if existing:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Procedura me referencën '{payload.reference_no}' ekziston tashmë",
            )

    proc = ProcedureModel(
        source_name=payload.source_name,
        source_url=payload.source_url,
        reference_no=payload.reference_no,
        notice_no=payload.notice_no,
        authority_name=payload.authority_name,
        object_description=payload.object_description,
        procedure_type=payload.procedure_type,
        contract_type=payload.contract_type,
        cpv_code=payload.cpv_code,
        fund_limit=payload.fund_limit,
        currency=payload.currency or "ALL",
        publication_date=payload.publication_date,
        opening_date=payload.opening_date,
        closing_date=payload.closing_date,
        status=payload.status,
    )
    db.add(proc)
    db.commit()
    db.refresh(proc)
    logger.info(f"Procedure '{proc.reference_no}' created manually by user {current_user.id}")

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
        document_count=0,
    )


# ---------------------------------------------------------------------------
# Requirements CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/{procedure_id}/requirements",
    response_model=RequiredDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a required document to a procedure",
)
def add_requirement(
    procedure_id: str,
    payload: RequiredDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RequiredDocumentResponse:
    """Manually add a required document item to a procedure."""
    from app.models.analysis import RequiredDocumentItem
    from sqlalchemy import select
    from app.models.procedure import Procedure as ProcedureModel

    proc = db.execute(
        select(ProcedureModel).where(ProcedureModel.id == procedure_id)
    ).scalar_one_or_none()
    if not proc:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedura nuk u gjet")

    item = RequiredDocumentItem(
        procedure_id=procedure_id,
        name=payload.name,
        category=payload.category,
        description=payload.description,
        mandatory=payload.mandatory,
        issuer_type=payload.issuer_type,
        source_hint=payload.source_hint,
        validity_rule=payload.validity_rule,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(f"Requirement '{item.name}' added to procedure {procedure_id} by user {current_user.id}")
    return RequiredDocumentResponse.model_validate(item)


@router.get(
    "/{procedure_id}/requirements",
    response_model=List[RequiredDocumentResponse],
    summary="List required documents for a procedure",
)
def list_requirements(
    procedure_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[RequiredDocumentResponse]:
    """List all manually-entered or AI-extracted required documents for a procedure."""
    from app.models.analysis import RequiredDocumentItem
    from sqlalchemy import select

    items = db.execute(
        select(RequiredDocumentItem).where(RequiredDocumentItem.procedure_id == procedure_id)
        .order_by(RequiredDocumentItem.category, RequiredDocumentItem.name)
    ).scalars().all()
    return [RequiredDocumentResponse.model_validate(i) for i in items]


@router.delete(
    "/{procedure_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an uploaded procedure document",
)
def delete_procedure_document(
    procedure_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    """Delete an uploaded document from a procedure."""
    from app.models.procedure import ProcedureDocument as ProcedureDocumentModel
    from app.core.storage import delete_file
    from sqlalchemy import select

    doc = db.execute(
        select(ProcedureDocumentModel).where(
            ProcedureDocumentModel.id == document_id,
            ProcedureDocumentModel.procedure_id == procedure_id,
        )
    ).scalar_one_or_none()
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dokumenti nuk u gjet")
    file_path = doc.file_path
    db.delete(doc)
    db.commit()
    if file_path:
        try:
            delete_file(file_path)
        except Exception:
            pass


@router.delete(
    "/{procedure_id}/requirements/{requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a required document from a procedure",
)
def delete_requirement(
    procedure_id: str,
    requirement_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    """Remove a required document item from a procedure."""
    from app.models.analysis import RequiredDocumentItem
    from sqlalchemy import select

    item = db.execute(
        select(RequiredDocumentItem).where(
            RequiredDocumentItem.id == requirement_id,
            RequiredDocumentItem.procedure_id == procedure_id,
        )
    ).scalar_one_or_none()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kërkesa nuk u gjet")
    db.delete(item)
    db.commit()
    logger.info(f"Requirement {requirement_id} deleted from procedure {procedure_id}")
