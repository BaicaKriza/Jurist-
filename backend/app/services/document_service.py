import hashlib
import logging
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path
from typing import Optional, BinaryIO
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status, UploadFile
from app.models.document import Document, DocumentStatus
from app.models.folder import Folder
from app.models.company import Company
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse, ExpiryAlertResponse
from app.core.storage import upload_file, get_file_url, delete_file
from app.core.config import settings
from app.utils.text_extract import TextExtractor

logger = logging.getLogger(__name__)


def compute_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class DocumentService:
    def __init__(self, db: Session):
        self.db = db

    def _validate_file(self, file: UploadFile) -> None:
        """Validate file extension and size."""
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Emri i skedarit mungon")
        ext = Path(file.filename).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Zgjatimi '{ext}' nuk lejohet. Lejohen: {', '.join(settings.ALLOWED_EXTENSIONS)}",
            )

    async def upload_document(
        self,
        company_id: str,
        file: UploadFile,
        metadata: DocumentCreate,
        created_by: Optional[str] = None,
    ) -> Document:
        """Upload a document file and save metadata to DB."""
        self._validate_file(file)

        # Verify company exists
        company = self.db.execute(select(Company).where(Company.id == company_id)).scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kompania nuk u gjet")

        # Validate folder belongs to company
        if metadata.folder_id:
            folder = self.db.execute(
                select(Folder).where(Folder.id == metadata.folder_id, Folder.company_id == company_id)
            ).scalar_one_or_none()
            if not folder:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dosja nuk u gjet ose nuk i përket kësaj kompanie")

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Skedari është shumë i madh. Maksimumi: {settings.MAX_UPLOAD_SIZE_MB} MB",
            )

        checksum = compute_checksum(file_content)
        file_ext = Path(file.filename).suffix.lower()
        object_name = f"companies/{company_id}/documents/{checksum}{file_ext}"

        # Detect mime type
        mime_type = file.content_type or "application/octet-stream"

        # Upload to MinIO
        upload_file(file_content, object_name, content_type=mime_type)

        # Extract text
        extracted_text = None
        try:
            with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name
            extractor = TextExtractor()
            extracted_text = extractor.extract(tmp_path, mime_type)
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

        # Determine status based on expiry date
        doc_status = DocumentStatus.ACTIVE
        if metadata.expiry_date and metadata.expiry_date < date.today():
            doc_status = DocumentStatus.EXPIRED

        document = Document(
            company_id=company_id,
            folder_id=metadata.folder_id,
            title=metadata.title,
            doc_type=metadata.doc_type,
            issuer=metadata.issuer,
            reference_no=metadata.reference_no,
            issue_date=metadata.issue_date,
            expiry_date=metadata.expiry_date,
            file_name=file.filename,
            storage_path=object_name,
            mime_type=mime_type,
            file_size=file_size,
            checksum=checksum,
            version_no=1,
            status=doc_status,
            extracted_text=extracted_text,
            metadata_json=metadata.metadata_json or {},
            created_by=created_by,
        )
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        logger.info(f"Document {document.id} uploaded for company {company_id}")
        return document

    def _normalize_status_filter(self, status_filter: Optional[str]) -> Optional[DocumentStatus]:
        if not status_filter:
            return None
        norm = status_filter.strip().lower()
        mapping = {
            'valid': DocumentStatus.ACTIVE,
            'active': DocumentStatus.ACTIVE,
            'expired': DocumentStatus.EXPIRED,
            'archived': DocumentStatus.ARCHIVED,
            'review_required': DocumentStatus.REVIEW_REQUIRED,
            'reviewrequired': DocumentStatus.REVIEW_REQUIRED,
            'review': DocumentStatus.REVIEW_REQUIRED,
            'expiring_soon': DocumentStatus.ACTIVE,
        }
        return mapping.get(norm)

    def get_documents(
        self,
        company_id: Optional[str] = None,
        folder_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Document], int]:
        query = select(Document)
        if company_id:
            query = query.where(Document.company_id == company_id)
        if folder_id:
            query = query.where(Document.folder_id == folder_id)

        doc_status = self._normalize_status_filter(status_filter)
        if doc_status:
            query = query.where(Document.status == doc_status)
        if status_filter and status_filter.strip().lower() == 'expiring_soon':
            from datetime import date, timedelta
            today = date.today()
            soon = today + timedelta(days=30)
            query = query.where(
                Document.status == DocumentStatus.ACTIVE,
                Document.expiry_date.isnot(None),
                Document.expiry_date >= today,
                Document.expiry_date <= soon,
            )
        if search:
            query = query.where(
                Document.title.ilike(f"%{search}%") |
                Document.reference_no.ilike(f"%{search}%") |
                Document.issuer.ilike(f"%{search}%")
            )

        total = self.db.execute(
            select(func.count()).select_from(query.subquery())
        ).scalar() or 0

        documents = self.db.execute(
            query.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).scalars().all()

        return list(documents), total

    def get_document(self, document_id: str, company_id: Optional[str] = None) -> Document:
        query = select(Document).where(Document.id == document_id)
        if company_id:
            query = query.where(Document.company_id == company_id)
        doc = self.db.execute(query).scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dokumenti nuk u gjet")
        return doc

    def update_document(self, document_id: str, company_id: str, data: DocumentUpdate) -> Document:
        doc = self.get_document(document_id, company_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(doc, key, value)
        # Auto-update status based on expiry
        if doc.expiry_date and doc.expiry_date < date.today() and doc.status == DocumentStatus.ACTIVE:
            doc.status = DocumentStatus.EXPIRED
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def delete_document(self, document_id: str, company_id: str) -> bool:
        doc = self.get_document(document_id, company_id)
        storage_path = doc.storage_path
        self.db.delete(doc)
        self.db.commit()
        # Delete from MinIO
        try:
            delete_file(storage_path)
        except Exception as e:
            logger.warning(f"Could not delete file from storage: {e}")
        return True

    def get_download_url(self, document_id: str, company_id: Optional[str] = None) -> str:
        doc = self.get_document(document_id, company_id)
        return get_file_url(doc.storage_path)

    def get_expiring_documents(
        self,
        days: int = 30,
        company_id: Optional[str] = None,
    ) -> list[dict]:
        today = date.today()
        future = today + timedelta(days=days)

        query = (
            select(Document, Company, Folder)
            .join(Company, Company.id == Document.company_id)
            .outerjoin(Folder, Folder.id == Document.folder_id)
            .where(
                Document.status == DocumentStatus.ACTIVE,
                Document.expiry_date.isnot(None),
                Document.expiry_date >= today,
                Document.expiry_date <= future,
            )
        )
        if company_id:
            query = query.where(Document.company_id == company_id)

        rows = self.db.execute(query.order_by(Document.expiry_date)).all()
        results = []
        for doc, company, folder in rows:
            delta = (doc.expiry_date - today).days
            results.append({
                "id": doc.id,
                "company_id": doc.company_id,
                "company_name": company.name,
                "title": doc.title,
                "expiry_date": doc.expiry_date,
                "days_until_expiry": delta,
                "status": doc.status,
                "folder_id": doc.folder_id,
                "folder_name": folder.name if folder else None,
            })
        return results

    def sync_document_statuses(self, company_id: Optional[str] = None) -> int:
        """Update ACTIVE documents that have passed their expiry date."""
        today = date.today()
        query = select(Document).where(
            Document.status == DocumentStatus.ACTIVE,
            Document.expiry_date.isnot(None),
            Document.expiry_date < today,
        )
        if company_id:
            query = query.where(Document.company_id == company_id)

        docs = self.db.execute(query).scalars().all()
        count = 0
        for doc in docs:
            doc.status = DocumentStatus.EXPIRED
            count += 1
        if count:
            self.db.commit()
        return count

    def to_response(self, doc: Document) -> DocumentResponse:
        try:
            download_url = get_file_url(doc.storage_path)
        except Exception:
            download_url = None

        # map internal DB status to client-friendly status categories
        status = doc.status
        if status == DocumentStatus.ACTIVE:
            from datetime import date, timedelta
            if doc.expiry_date:
                today = date.today()
                if doc.expiry_date < today:
                    status = "expired"
                elif doc.expiry_date <= today + timedelta(days=30):
                    status = "expiring_soon"
                else:
                    status = "valid"
            else:
                status = "valid"
        elif status == DocumentStatus.EXPIRED:
            status = "expired"
        elif status == DocumentStatus.REVIEW_REQUIRED:
            status = "expiring_soon"
        elif status == DocumentStatus.ARCHIVED:
            status = "invalid"

        company_info = None
        if getattr(doc, 'company', None):
            company_obj = doc.company
            company_info = {
                'id': company_obj.id,
                'name': company_obj.name,
            }

        response = DocumentResponse(
            id=doc.id,
            company_id=doc.company_id,
            folder_id=doc.folder_id,
            title=doc.title,
            doc_type=doc.doc_type,
            issuer=doc.issuer,
            reference_no=doc.reference_no,
            issue_date=doc.issue_date,
            expiry_date=doc.expiry_date,
            file_name=doc.file_name,
            mime_type=doc.mime_type,
            file_size=doc.file_size,
            checksum=doc.checksum,
            version_no=doc.version_no,
            status=status,
            ai_summary=doc.ai_summary,
            metadata_json=doc.metadata_json,
            created_by=doc.created_by,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            download_url=download_url,
        )

        # add non-standard optional fields for frontend convenience
        setattr(response, 'company', company_info)

        return response
