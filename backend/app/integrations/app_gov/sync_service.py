import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.procedure import Procedure, ProcedureDocument, ProcedureSource, ProcedureStatus
from app.integrations.app_gov.crawler import AppGovCrawler
from app.integrations.app_gov.parser import AppGovParser
from app.integrations.app_gov.normalizer import AppGovNormalizer
from app.core.config import settings
from app.schemas.procedure import ProcedureSyncResponse

logger = logging.getLogger(__name__)


class AppGovSyncService:
    """Orchestrates full sync from APP.gov.al."""

    def __init__(self, db: Session):
        self.db = db
        self.parser = AppGovParser()
        self.normalizer = AppGovNormalizer()

    async def run_full_sync(
        self,
        source: Optional[str] = None,
        max_pages: int = 5,
        force_refresh: bool = False,
    ) -> ProcedureSyncResponse:
        """Run complete sync: crawl -> parse -> normalize -> save."""
        synced = 0
        updated = 0
        errors = 0

        sources_to_sync = []
        if source == "CONTRACT_NOTICE" or source is None:
            sources_to_sync.append((ProcedureSource.CONTRACT_NOTICE, settings.APP_GOV_NOTICES_URL))
        if source == "SMALL_VALUE" or source is None:
            sources_to_sync.append((ProcedureSource.SMALL_VALUE, settings.APP_GOV_SMALL_VALUE_URL))

        async with AppGovCrawler() as crawler:
            for source_type, base_url in sources_to_sync:
                try:
                    pages = await crawler.fetch_listing_pages(base_url, max_pages=max_pages)
                    logger.info(f"Fetched {len(pages)} pages for {source_type}")

                    for page_num, html in pages:
                        if page_num == 1:
                            page_url = base_url
                        else:
                            separator = "&" if "?" in base_url else "?"
                            page_url = f"{base_url}{separator}paged={page_num}"

                        if source_type == ProcedureSource.CONTRACT_NOTICE:
                            raw_items = self.parser.parse_contract_notices(html, page_url=page_url)
                        else:
                            raw_items = self.parser.parse_small_value_procedures(html, page_url=page_url)

                        logger.info(
                            "Parsed %s APP items from %s page %s",
                            len(raw_items),
                            source_type,
                            page_num,
                        )

                        for raw_item in raw_items:
                            try:
                                result = await self._process_item(
                                    raw_item, source_type, crawler, force_refresh
                                )
                                if result == "new":
                                    synced += 1
                                elif result == "updated":
                                    updated += 1
                            except Exception as e:
                                logger.error(f"Error processing item: {e}")
                                errors += 1

                except Exception as e:
                    logger.error(f"Sync failed for {source_type}: {e}")
                    errors += 1

        msg = f"Sinkronizim i kompletuar: {synced} të reja, {updated} të përditësuara, {errors} gabime"
        return ProcedureSyncResponse(
            synced_count=synced,
            updated_count=updated,
            errors=errors,
            message=msg,
            source=source,
        )

    async def _process_item(
        self,
        raw_item: dict,
        source_type: ProcedureSource,
        crawler: AppGovCrawler,
        force_refresh: bool,
    ) -> str:
        """Process a single listing item. Returns 'new', 'updated', or 'skipped'."""
        source_url = raw_item.get("source_url", "")
        if not source_url:
            return "skipped"

        # Normalize URL
        if source_url.startswith("/"):
            source_url = "https://www.app.gov.al" + source_url
        elif source_url.startswith("//"):
            source_url = "https:" + source_url

        # Check if already exists
        existing = self.db.execute(
            select(Procedure).where(Procedure.source_url == source_url)
        ).scalar_one_or_none()

        if existing and not force_refresh:
            return "skipped"

        # APP.gov.al currently renders item details inline in Bootstrap modals.
        # When the parser already provides raw_html, avoid fetching the listing
        # URL again and accidentally parsing the wrong modal.
        detail_html = raw_item.get("raw_html")
        if detail_html:
            detail_data = raw_item
        else:
            detail_html = await crawler.fetch_detail_page(source_url)
            if not detail_html:
                return "skipped"
            detail_data = self.parser.parse_procedure_detail(detail_html, source_url)
        # Merge listing data with detail data
        merged = {**raw_item, **detail_data}
        normalized = self.normalizer.normalize_procedure(merged)

        if existing:
            # Update existing
            self._update_procedure(existing, normalized, source_type, detail_html)
            return "updated"
        else:
            # Create new
            self._create_procedure(normalized, source_type, detail_html)
            return "new"

    def _create_procedure(self, data: dict, source_type: ProcedureSource, raw_html: str) -> Procedure:
        status = self._determine_status(data)
        procedure = Procedure(
            source_name=source_type,
            source_url=data.get("source_url"),
            reference_no=data.get("reference_no"),
            notice_no=data.get("notice_no"),
            authority_name=data.get("authority_name"),
            object_description=data.get("object_description"),
            procedure_type=data.get("procedure_type"),
            contract_type=data.get("contract_type"),
            cpv_code=data.get("cpv_code"),
            fund_limit=data.get("fund_limit"),
            currency=data.get("currency", "ALL"),
            publication_date=data.get("publication_date"),
            opening_date=data.get("opening_date"),
            closing_date=data.get("closing_date"),
            status=status,
            raw_html=raw_html[:50000] if raw_html else None,
            raw_json=data.get("raw_json", {}),
        )
        self.db.add(procedure)
        self.db.flush()

        # Create document links
        for doc_link in data.get("document_links", []):
            proc_doc = ProcedureDocument(
                procedure_id=procedure.id,
                title=doc_link.get("title"),
                document_url=doc_link.get("url"),
            )
            self.db.add(proc_doc)

        self.db.commit()
        logger.info(f"Created procedure: {procedure.reference_no or procedure.object_description[:50]}")
        return procedure

    def _update_procedure(
        self, procedure: Procedure, data: dict, source_type: ProcedureSource, raw_html: str
    ) -> None:
        for field in [
            "authority_name", "object_description", "procedure_type", "contract_type",
            "cpv_code", "fund_limit", "currency", "publication_date", "opening_date",
            "closing_date", "reference_no", "notice_no",
        ]:
            if data.get(field) is not None:
                setattr(procedure, field, data[field])

        procedure.status = self._determine_status(data)
        procedure.raw_html = raw_html[:50000] if raw_html else procedure.raw_html
        procedure.raw_json = data.get("raw_json", {}) or procedure.raw_json

        # Add any new document links
        existing_urls = {d.document_url for d in procedure.procedure_documents if d.document_url}
        for doc_link in data.get("document_links", []):
            url = doc_link.get("url")
            if url and url not in existing_urls:
                proc_doc = ProcedureDocument(
                    procedure_id=procedure.id,
                    title=doc_link.get("title"),
                    document_url=url,
                )
                self.db.add(proc_doc)

        self.db.commit()

    def _determine_status(self, data: dict) -> ProcedureStatus:
        from datetime import date
        closing_date = data.get("closing_date")
        if closing_date:
            try:
                if closing_date < date.today():
                    return ProcedureStatus.CLOSED
                else:
                    return ProcedureStatus.OPEN
            except Exception:
                pass
        return ProcedureStatus.UNKNOWN
