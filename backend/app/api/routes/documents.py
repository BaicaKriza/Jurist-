import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
    DocumentUploadResponse,
    ExpiryAlertResponse,
)
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])


# ---------------------------------------------------------------------------
# Global documents list (all companies, auth required)
# ---------------------------------------------------------------------------

@router.get(
    "/documents",
    response_model=dict,
    summary="List all documents (optional company filter)",
)
def list_all_documents(
    company_id: Optional[str] = Query(None, description="Filter by company ID"),
    folder_id: Optional[str] = Query(None, description="Filter by folder ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title, reference or issuer"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return documents across all companies, with optional filters."""
    from app.models.company import Company

    query = select(Document)
    if company_id:
        query = query.where(Document.company_id == company_id)
    if folder_id:
        query = query.where(Document.folder_id == folder_id)
    if status_filter:
        query = query.where(Document.status == status_filter)
    if search:
        query = query.where(
            Document.title.ilike(f"%{search}%") |
            Document.reference_no.ilike(f"%{search}%") |
            Document.issuer.ilike(f"%{search}%")
        )

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
    documents = db.execute(
        query.order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    service = DocumentService(db)
    return {
        "items": [service.to_response(doc) for doc in documents],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get(
    "/companies/{company_id}/documents",
    response_model=dict,
    summary="List documents for a company",
)
def list_documents(
    company_id: str,
    folder_id: Optional[str] = Query(None, description="Filter by folder ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by document status"),
    search: Optional[str] = Query(None, description="Search in title, reference or issuer"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return a paginated list of documents belonging to a company, with optional filters."""
    service = DocumentService(db)
    documents, total = service.get_documents(
        company_id=company_id,
        folder_id=folder_id,
        status_filter=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    items = [service.to_response(doc) for doc in documents]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post(
    "/companies/{company_id}/documents/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document for a company",
)
async def upload_document(
    company_id: str,
    file: UploadFile = File(..., description="Document file to upload"),
    title: str = Form(..., min_length=1, max_length=512, description="Document title"),
    doc_type: Optional[str] = Form(None, description="Document type"),
    issuer: Optional[str] = Form(None, description="Issuing organization"),
    reference_no: Optional[str] = Form(None, description="Reference number"),
    issue_date: Optional[str] = Form(None, description="Issue date (YYYY-MM-DD)"),
    expiry_date: Optional[str] = Form(None, description="Expiry date (YYYY-MM-DD)"),
    folder_id: Optional[str] = Form(None, description="Target folder ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentUploadResponse:
    """Upload a document file with metadata fields provided as multipart form data."""
    from datetime import date as date_type

    def parse_date(val: Optional[str]) -> Optional[date_type]:
        if not val:
            return None
        try:
            return date_type.fromisoformat(val)
        except ValueError:
            return None

    metadata = DocumentCreate(
        title=title,
        doc_type=doc_type,
        issuer=issuer,
        reference_no=reference_no,
        issue_date=parse_date(issue_date),
        expiry_date=parse_date(expiry_date),
        folder_id=folder_id,
    )

    service = DocumentService(db)
    document = await service.upload_document(
        company_id=company_id,
        file=file,
        metadata=metadata,
        created_by=current_user.id,
    )
    logger.info(f"Document '{document.title}' uploaded for company {company_id} by user {current_user.id}")
    return DocumentUploadResponse(
        id=document.id,
        title=document.title,
        file_name=document.file_name,
        file_size=document.file_size,
        mime_type=document.mime_type,
        status=document.status,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Get a document by ID",
)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DocumentResponse:
    """Retrieve full metadata and a presigned download URL for a single document."""
    service = DocumentService(db)
    document = service.get_document(document_id)
    return service.to_response(document)


@router.patch(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Update document metadata",
)
def update_document(
    document_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    """Update mutable metadata fields (title, dates, folder, status) of an existing document."""
    service = DocumentService(db)
    # Retrieve document first to get company_id for ownership scoping
    existing = service.get_document(document_id)
    document = service.update_document(document_id, existing.company_id, payload)
    logger.info(f"Document {document_id} updated by user {current_user.id}")
    return service.to_response(document)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a document record and remove its file from object storage."""
    service = DocumentService(db)
    existing = service.get_document(document_id)
    service.delete_document(document_id, existing.company_id)
    logger.info(f"Document {document_id} deleted by user {current_user.id}")


@router.get(
    "/documents/{document_id}/download",
    summary="Redirect to presigned download URL",
    status_code=status.HTTP_302_FOUND,
)
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RedirectResponse:
    """Generate a presigned download URL and redirect the client to it."""
    service = DocumentService(db)
    url = service.get_download_url(document_id)
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/expiring",
    response_model=List[ExpiryAlertResponse],
    summary="Get documents expiring soon",
)
def get_expiring_documents(
    days: int = Query(30, ge=1, le=365, description="Number of days ahead to check"),
    company_id: Optional[str] = Query(None, description="Limit to a specific company"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[ExpiryAlertResponse]:
    """Return all active documents whose expiry date falls within the specified number of days."""
    service = DocumentService(db)
    results = service.get_expiring_documents(days=days, company_id=company_id)
    return [ExpiryAlertResponse(**item) for item in results]
