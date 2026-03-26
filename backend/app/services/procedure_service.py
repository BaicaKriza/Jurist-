import logging
from typing import Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from fastapi import HTTPException, status
from app.models.procedure import Procedure, ProcedureDocument, ProcedureSource, ProcedureStatus
from app.schemas.procedure import SyncRequest, ProcedureSyncResponse

logger = logging.getLogger(__name__)


class ProcedureService:
    def __init__(self, db: Session):
        self.db = db

    async def sync_from_app(self, sync_request: SyncRequest) -> ProcedureSyncResponse:
        """Trigger a sync from app.gov.al."""
        from app.integrations.app_gov.sync_service import AppGovSyncService
        sync_service = AppGovSyncService(self.db)
        result = await sync_service.run_full_sync(
            source=sync_request.source,
            max_pages=sync_request.max_pages,
            force_refresh=sync_request.force_refresh,
        )
        return result

    def get_procedures(
        self,
        source_name: Optional[str] = None,
        status_filter: Optional[str] = None,
        authority_name: Optional[str] = None,
        cpv_code: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Procedure], int]:
        query = select(Procedure)
        if source_name:
            query = query.where(Procedure.source_name == source_name)
        if status_filter:
            query = query.where(Procedure.status == status_filter)
        if authority_name:
            query = query.where(Procedure.authority_name.ilike(f"%{authority_name}%"))
        if cpv_code:
            query = query.where(Procedure.cpv_code.ilike(f"%{cpv_code}%"))
        if date_from:
            query = query.where(Procedure.publication_date >= date_from)
        if date_to:
            query = query.where(Procedure.publication_date <= date_to)
        if search:
            query = query.where(
                or_(
                    Procedure.object_description.ilike(f"%{search}%"),
                    Procedure.authority_name.ilike(f"%{search}%"),
                    Procedure.reference_no.ilike(f"%{search}%"),
                )
            )

        total = self.db.execute(
            select(func.count()).select_from(query.subquery())
        ).scalar() or 0

        procedures = self.db.execute(
            query.order_by(Procedure.publication_date.desc(), Procedure.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).scalars().all()

        return list(procedures), total

    def get_procedure(self, procedure_id: str) -> Procedure:
        proc = self.db.execute(
            select(Procedure).where(Procedure.id == procedure_id)
        ).scalar_one_or_none()
        if not proc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedura nuk u gjet")
        return proc

    def get_procedure_documents(self, procedure_id: str) -> list[ProcedureDocument]:
        self.get_procedure(procedure_id)  # Verify exists
        docs = self.db.execute(
            select(ProcedureDocument).where(ProcedureDocument.procedure_id == procedure_id)
        ).scalars().all()
        return list(docs)

    async def analyze_procedure(self, procedure_id: str) -> dict:
        """Trigger AI analysis of a procedure."""
        procedure = self.get_procedure(procedure_id)
        from app.services.analysis_service import AnalysisService
        analysis_service = AnalysisService(self.db)
        result = await analysis_service.analyze_procedure_with_ai(procedure)
        return result

    async def download_procedure_documents(self, procedure_id: str) -> dict:
        """Download all linked documents for a procedure."""
        from app.integrations.app_gov.downloader import DocumentDownloader
        procedure = self.get_procedure(procedure_id)
        docs = self.get_procedure_documents(procedure_id)
        downloader = DocumentDownloader(self.db)
        results = await downloader.download_procedure_documents(procedure, docs)
        return results

    def get_procedure_doc_count(self, procedure_id: str) -> int:
        return self.db.execute(
            select(func.count(ProcedureDocument.id)).where(
                ProcedureDocument.procedure_id == procedure_id
            )
        ).scalar() or 0
