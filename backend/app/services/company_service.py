import logging
from typing import Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.company import Company
from app.models.document import Document, DocumentStatus
from app.models.folder import Folder
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyStatsResponse, CompanyListResponse
from app.services.folder_service import FolderService

logger = logging.getLogger(__name__)


class CompanyService:
    def __init__(self, db: Session):
        self.db = db

    def create_company(self, data: CompanyCreate, creator_id: Optional[str] = None) -> Company:
        """Create a company and auto-generate the 10 standard folders."""
        existing = self.db.execute(
            select(Company).where(Company.nipt == data.nipt)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Kompania me NIPT '{data.nipt}' ekziston tashmë",
            )

        company = Company(
            name=data.name,
            nipt=data.nipt,
            legal_form=data.legal_form,
            administrator_name=data.administrator_name,
            email=data.email,
            phone=data.phone,
            address=data.address,
            notes=data.notes,
            is_active=data.is_active,
        )
        self.db.add(company)
        self.db.flush()  # Get the ID without committing

        # Auto-create standard folders
        folder_service = FolderService(self.db)
        folder_service.create_standard_folders(company.id)

        self.db.commit()
        self.db.refresh(company)
        logger.info(f"Created company {company.name} (NIPT: {company.nipt}) with standard folders")
        return company

    def get_company(self, company_id: str) -> Company:
        company = self.db.execute(
            select(Company).where(Company.id == company_id)
        ).scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kompania nuk u gjet")
        return company

    def list_companies(
        self,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = select(Company)
        if search:
            query = query.where(
                Company.name.ilike(f"%{search}%") | Company.nipt.ilike(f"%{search}%")
            )
        if is_active is not None:
            query = query.where(Company.is_active == is_active)

        total = self.db.execute(
            select(func.count()).select_from(query.subquery())
        ).scalar() or 0

        companies = self.db.execute(
            query.order_by(Company.name).offset((page - 1) * page_size).limit(page_size)
        ).scalars().all()

        # Get document counts for each company
        company_ids = [c.id for c in companies]
        doc_counts = {}
        expired_counts = {}
        if company_ids:
            counts = self.db.execute(
                select(Document.company_id, func.count(Document.id))
                .where(Document.company_id.in_(company_ids))
                .group_by(Document.company_id)
            ).all()
            for cid, count in counts:
                doc_counts[cid] = count

            expired = self.db.execute(
                select(Document.company_id, func.count(Document.id))
                .where(
                    Document.company_id.in_(company_ids),
                    Document.status == DocumentStatus.EXPIRED,
                )
                .group_by(Document.company_id)
            ).all()
            for cid, count in expired:
                expired_counts[cid] = count

        result = []
        for c in companies:
            result.append({
                "id": c.id,
                "name": c.name,
                "nipt": c.nipt,
                "legal_form": c.legal_form,
                "administrator_name": c.administrator_name,
                "is_active": c.is_active,
                "status": c.status,
                "created_at": c.created_at,
                "document_count": doc_counts.get(c.id, 0),
                "expired_count": expired_counts.get(c.id, 0),
            })
        return result, total

    def update_company(self, company_id: str, data: CompanyUpdate) -> Company:
        company = self.get_company(company_id)
        update_data = data.model_dump(exclude_unset=True)
        if "nipt" in update_data and update_data["nipt"] != company.nipt:
            existing = self.db.execute(
                select(Company).where(Company.nipt == update_data["nipt"])
            ).scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"NIPT '{update_data['nipt']}' është i zënë nga kompani tjetër",
                )
        for key, value in update_data.items():
            setattr(company, key, value)
        self.db.commit()
        self.db.refresh(company)
        return company

    def deactivate_company(self, company_id: str) -> Company:
        company = self.get_company(company_id)
        company.is_active = False
        self.db.commit()
        self.db.refresh(company)
        return company

    def activate_company(self, company_id: str) -> Company:
        company = self.get_company(company_id)
        company.is_active = True
        self.db.commit()
        self.db.refresh(company)
        return company

    def delete_company(self, company_id: str) -> bool:
        company = self.get_company(company_id)
        self.db.delete(company)
        self.db.commit()
        return True

    def get_company_stats(self, company_id: str) -> CompanyStatsResponse:
        company = self.get_company(company_id)
        today = date.today()
        soon = today + timedelta(days=30)

        total_docs = self.db.execute(
            select(func.count(Document.id)).where(Document.company_id == company_id)
        ).scalar() or 0

        active_docs = self.db.execute(
            select(func.count(Document.id)).where(
                Document.company_id == company_id,
                Document.status == DocumentStatus.ACTIVE,
            )
        ).scalar() or 0

        expired_docs = self.db.execute(
            select(func.count(Document.id)).where(
                Document.company_id == company_id,
                Document.status == DocumentStatus.EXPIRED,
            )
        ).scalar() or 0

        review_docs = self.db.execute(
            select(func.count(Document.id)).where(
                Document.company_id == company_id,
                Document.status == DocumentStatus.REVIEW_REQUIRED,
            )
        ).scalar() or 0

        expiring_soon = self.db.execute(
            select(func.count(Document.id)).where(
                Document.company_id == company_id,
                Document.status == DocumentStatus.ACTIVE,
                Document.expiry_date.isnot(None),
                Document.expiry_date >= today,
                Document.expiry_date <= soon,
            )
        ).scalar() or 0

        total_folders = self.db.execute(
            select(func.count(Folder.id)).where(Folder.company_id == company_id)
        ).scalar() or 0

        return CompanyStatsResponse(
            company_id=company_id,
            company_name=company.name,
            total_documents=total_docs,
            active_documents=active_docs,
            expired_documents=expired_docs,
            review_required=review_docs,
            expiring_soon=expiring_soon,
            total_folders=total_folders,
        )
