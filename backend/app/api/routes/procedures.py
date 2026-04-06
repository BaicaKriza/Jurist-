import io
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
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

ALLOWED_DOC_TYPES = ["DST", "NJOFTIM", "SPECIFIKIME", "KRITERE", "KONTRATE", "SQARIM", "BULETIN", "TJETER"]


# ---------------------------------------------------------------------------
# Background task: generate AI summary for uploaded procedure document
# ---------------------------------------------------------------------------

def generate_ai_summary_task(doc_id: str, text: str, db: Session):
        try:
                    import openai
                    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{
                            "role": "user",
                            "content": f"""Analizoni këtë dokument prokurimi shqiptar. Nxirrni dhe përmbledhni: lloji i dokumentit, kërkesat kryesore, kriteret e kualifikimit, afatet, kushtet speciale. Ktheni si JSON: {{"doc_type":"...","summary":"...","key_points":[],"deadlines":[],"requirements":[],"flags":[]}} Teksti: {text[:4000]}"""
                        }],
                        response_format={"type": "json_object"}
                    )
                    summary = response.choices[0].message.content
                    from app.models.procedure import ProcedureUploadedDocument
                    from sqlalchemy import select
                    doc = db.execute(select(ProcedureUploadedDocument).where(ProcedureUploadedDocument.id == doc_id)).scalar_one_or_none()
                    if doc:
                                    doc.ai_summary = summary
                                    db.commit()
                                    logger.info(f"AI summary generated for procedure document {doc_id}")
        except Exception as e:
                    logger.warning(f"AI summary generation failed for doc {doc_id}: {e}")


# ---------------------------------------------------------------------------
# List / Get procedures
# ---------------------------------------------------------------------------

@router.get(
        "",
        response_model=dict,
        summary="List procurement procedures",
)
def list_procedures(
        source_name: Optional[str] = Query(None),
        status_filter: Optional[str] = Query(None, alias="status"),
        authority_name: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
) -> dict:
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
                    items.append(ProcedureResponse(
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
                    ))
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


# ---------------------------------------------------------------------------
# Sync / Analyze / Download
# ---------------------------------------------------------------------------

@router.post("/sync", response_model=ProcedureSyncResponse, summary="Sync from APP portal")
async def sync_procedures(
        payload: SyncRequest,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
) -> ProcedureSyncResponse:
        service = ProcedureService(db)
    result = await service.sync_from_app(payload)
    return result


@router.post("/{procedure_id}/analyze", response_model=dict, summary="Analyze with AI")
async def analyze_procedure(
        procedure_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
) -> dict:
        service = ProcedureService(db)
    analysis = await service.analyze_procedure(procedure_id)
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


@router.post("/{procedure_id}/download-documents", response_model=dict)
async def download_procedure_documents(
        procedure_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
) -> dict:
        service = ProcedureService(db)
    result = await service.download_procedure_documents(procedure_id)
    return result


# ---------------------------------------------------------------------------
# Procedure documents from APP (existing scraped docs)
# ---------------------------------------------------------------------------

@router.get(
        "/{procedure_id}/documents",
        response_model=List[ProcedureDocumentResponse],
        summary="Get scraped documents for a procedure",
)
def get_procedure_documents(
        procedure_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
) -> List[ProcedureDocumentResponse]:
        service = ProcedureService(db)
    docs = service.get_procedure_documents(procedure_id)
    return [ProcedureDocumentResponse.model_validate(d) for d in docs]


# ---------------------------------------------------------------------------
# USER-UPLOADED procedure documents (NEW FEATURE)
# ---------------------------------------------------------------------------

@router.post(
        "/{procedure_id}/upload",
        summary="Upload a file directly to a procedure",
        status_code=status.HTTP_201_CREATED,
)
async def upload_procedure_document(
        procedure_id: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        title: str = Form(...),
        doc_type: str = Form(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
        from app.models.procedure import Procedure as ProcedureModel, ProcedureUploadedDocument
    from sqlalchemy import select

    if doc_type not in ALLOWED_DOC_TYPES:
                raise HTTPException(400, f"doc_type i pavlefshëm. Vlerat e lejuara: {', '.join(ALLOWED_DOC_TYPES)}")

    proc = db.execute(select(ProcedureModel).where(ProcedureModel.id == procedure_id)).scalar_one_or_none()
    if not proc:
                raise HTTPException(404, "Procedura nuk u gjet")

    content = await file.read()
    file_size = len(content)

    # Save file to local storage
    storage_dir = os.getenv("STORAGE_PATH", "./storage/procedure_docs")
    os.makedirs(storage_dir, exist_ok=True)
    safe_name = f"{procedure_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join(storage_dir, safe_name)
    with open(file_path, "wb") as f:
                f.write(content)

    # Extract text
    extracted_text = ""
    mime = file.content_type or ""
    try:
                if "pdf" in mime or file.filename.lower().endswith(".pdf"):
                                import pdfplumber
                                with pdfplumber.open(io.BytesIO(content)) as pdf:
                                                    extracted_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
                elif "wordprocessingml" in mime or file.filename.lower().endswith(".docx"):
                                from docx import Document as DocxDocument
                                doc_obj = DocxDocument(io.BytesIO(content))
                                extracted_text = "\n".join(p.text for p in doc_obj.paragraphs)
    except Exception as e:
        logger.warning(f"Text extraction failed: {e}")

    # Save to DB
    uploaded_doc = ProcedureUploadedDocument(
                procedure_id=procedure_id,
                file_name=file.filename,
                file_path=file_path,
                doc_type=doc_type,
                title=title,
                extracted_text=extracted_text[:50000] if extracted_text else None,
                file_size=file_size,
                mime_type=mime,
                is_deleted=False,
                created_at=datetime.utcnow(),
    )
    db.add(uploaded_doc)
    db.commit()
    db.refresh(uploaded_doc)

    # Generate AI summary in background
    if extracted_text and os.getenv("OPENAI_API_KEY"):
                background_tasks.add_task(generate_ai_summary_task, uploaded_doc.id, extracted_text, db)

    return {
                "id": uploaded_doc.id,
                "file_name": uploaded_doc.file_name,
                "doc_type": uploaded_doc.doc_type,
                "title": uploaded_doc.title,
                "download_url": f"/procedures/{procedure_id}/upload/{uploaded_doc.id}/download",
                "file_size": uploaded_doc.file_size,
                "ai_summary": None,
                "created_at": uploaded_doc.created_at.isoformat() if uploaded_doc.created_at else None,
    }


@router.get("/{procedure_id}/upload", summary="List uploaded documents for a procedure")
def list_uploaded_documents(
        procedure_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
):
        from app.models.procedure import ProcedureUploadedDocument
    from sqlalchemy import select

    docs = db.execute(
                select(ProcedureUploadedDocument).where(
                                ProcedureUploadedDocument.procedure_id == procedure_id,
                                ProcedureUploadedDocument.is_deleted == False,
                ).order_by(ProcedureUploadedDocument.created_at.desc())
    ).scalars().all()

    return [
                {
                                "id": d.id,
                                "title": d.title,
                                "file_name": d.file_name,
                                "doc_type": d.doc_type,
                                "file_size": d.file_size,
                                "ai_summary": d.ai_summary,
                                "download_url": f"/procedures/{procedure_id}/upload/{d.id}/download",
                                "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs
    ]


@router.delete(
        "/{procedure_id}/upload/{doc_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Soft-delete an uploaded procedure document",
)
def delete_uploaded_document(
        procedure_id: str,
        doc_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
):
        from app.models.procedure import ProcedureUploadedDocument
    from sqlalchemy import select

    doc = db.execute(
                select(ProcedureUploadedDocument).where(
                                ProcedureUploadedDocument.id == doc_id,
                                ProcedureUploadedDocument.procedure_id == procedure_id,
                )
    ).scalar_one_or_none()
    if not doc:
                raise HTTPException(404, "Dokumenti nuk u gjet")
            doc.is_deleted = True
    db.commit()
    return Response(status_code=204)


@router.get(
        "/{procedure_id}/upload/{doc_id}/download",
        summary="Download an uploaded procedure document",
)
def download_uploaded_document(
        procedure_id: str,
        doc_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
):
        from app.models.procedure import ProcedureUploadedDocument
    from sqlalchemy import select

    doc = db.execute(
                select(ProcedureUploadedDocument).where(
                                ProcedureUploadedDocument.id == doc_id,
                                ProcedureUploadedDocument.procedure_id == procedure_id,
                                ProcedureUploadedDocument.is_deleted == False,
                )
    ).scalar_one_or_none()
    if not doc or not os.path.exists(doc.file_path):
                raise HTTPException(404, "Skedari nuk u gjet")
            return FileResponse(doc.file_path, filename=doc.file_name, media_type=doc.mime_type or "application/octet-stream")


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
        from app.models.procedure import Procedure as ProcedureModel
    from sqlalchemy import select

    if payload.reference_no:
                existing = db.execute(
                                select(ProcedureModel).where(ProcedureModel.reference_no == payload.reference_no)
                ).scalar_one_or_none()
                if existing:
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
    logger.info(f"Procedure '{proc.reference_no}' created by user {current_user.id}")

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
        from app.models.analysis import RequiredDocumentItem
    from app.models.procedure import Procedure as ProcedureModel
    from sqlalchemy import select

    proc = db.execute(select(ProcedureModel).where(ProcedureModel.id == procedure_id)).scalar_one_or_none()
    if not proc:
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
    logger.info(f"Requirement '{item.name}' added to procedure {procedure_id}")
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
        from app.models.analysis import RequiredDocumentItem
    from sqlalchemy import select

    items = db.execute(
                select(RequiredDocumentItem)
                .where(RequiredDocumentItem.procedure_id == procedure_id)
                .order_by(RequiredDocumentItem.category, RequiredDocumentItem.name)
    ).scalars().all()
    return [RequiredDocumentResponse.model_validate(i) for i in items]


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
        from app.models.analysis import RequiredDocumentItem
    from sqlalchemy import select

    item = db.execute(
                select(RequiredDocumentItem).where(
                                RequiredDocumentItem.id == requirement_id,
                                RequiredDocumentItem.procedure_id == procedure_id,
                )
    ).scalar_one_or_none()
    if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kërkesa nuk u gjet")
            db.delete(item)
    db.commit()
    logger.info(f"Requirement {requirement_id} deleted from procedure {procedure_id}")
