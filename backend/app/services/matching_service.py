import logging
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.matching import MatchingResult, RetrievalGuide, MatchStatus
from app.models.analysis import RequiredDocumentItem
from app.models.document import Document, DocumentStatus
from app.models.procedure import Procedure
from app.models.company import Company
from app.schemas.analysis import MatchingReportResponse, MatchingReportItem, RetrievalGuideCreate

logger = logging.getLogger(__name__)


class MatchingService:
    def __init__(self, db: Session):
        self.db = db

    def run_matching(self, procedure_id: str, company_id: str) -> list[MatchingResult]:
        """Run document matching for a procedure against company vault."""
        procedure = self.db.execute(
            select(Procedure).where(Procedure.id == procedure_id)
        ).scalar_one_or_none()
        if not procedure:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedura nuk u gjet")

        company = self.db.execute(
            select(Company).where(Company.id == company_id)
        ).scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kompania nuk u gjet")

        required_docs = self.db.execute(
            select(RequiredDocumentItem).where(RequiredDocumentItem.procedure_id == procedure_id)
        ).scalars().all()

        if not required_docs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nuk ka dokumente të kërkuara. Fillimisht analizoni procedurën.",
            )

        # Get all company documents
        company_docs = self.db.execute(
            select(Document).where(
                Document.company_id == company_id,
                Document.status.in_([DocumentStatus.ACTIVE, DocumentStatus.EXPIRED, DocumentStatus.REVIEW_REQUIRED]),
            )
        ).scalars().all()

        # Remove old matching results
        old_results = self.db.execute(
            select(MatchingResult).where(
                MatchingResult.procedure_id == procedure_id,
                MatchingResult.company_id == company_id,
            )
        ).scalars().all()
        for r in old_results:
            self.db.delete(r)
        self.db.flush()

        new_results = []
        for req_doc in required_docs:
            best_match = self._find_best_match(req_doc, company_docs)
            match_status = MatchStatus.MISSING
            matched_doc_id = None
            confidence_score = 0.0
            notes = None

            if best_match:
                matched_doc_id = best_match["document_id"]
                confidence_score = best_match["score"]
                doc = best_match["document"]

                if doc.status == DocumentStatus.EXPIRED:
                    match_status = MatchStatus.FOUND_EXPIRED
                    notes = "Dokumenti u gjet por ka skaduar"
                elif confidence_score >= 0.8:
                    match_status = MatchStatus.FOUND_VALID
                    notes = f"Ndeshje e sigurt (score: {confidence_score:.0%})"
                elif confidence_score >= 0.5:
                    match_status = MatchStatus.FOUND_PARTIAL
                    notes = f"Ndeshje e pjesshme - shqyrtoni manualisht (score: {confidence_score:.0%})"
                else:
                    match_status = MatchStatus.REVIEW_REQUIRED
                    notes = "Ndeshje e dobët - kërkohet shqyrtim manual"

            result = MatchingResult(
                procedure_id=procedure_id,
                company_id=company_id,
                required_document_item_id=req_doc.id,
                matched_document_id=matched_doc_id,
                match_status=match_status,
                confidence_score=confidence_score,
                notes=notes,
            )
            self.db.add(result)
            new_results.append(result)

        self.db.commit()
        return new_results

    def _find_best_match(self, req_doc: RequiredDocumentItem, company_docs: list[Document]) -> Optional[dict]:
        """Find the best matching document from company vault."""
        if not company_docs:
            return None

        best_score = 0.0
        best_doc = None

        req_name_lower = req_doc.name.lower()
        req_words = set(req_name_lower.split())

        for doc in company_docs:
            score = 0.0
            doc_title_lower = doc.title.lower()
            doc_words = set(doc_title_lower.split())

            # Word overlap score
            if req_words and doc_words:
                common = req_words & doc_words
                score = len(common) / max(len(req_words), len(doc_words))

            # Boost for doc_type match
            if doc.doc_type and req_doc.name.lower() in doc.doc_type.lower():
                score = min(score + 0.3, 1.0)

            # Boost for issuer match
            if req_doc.issuer_type and doc.issuer and req_doc.issuer_type.lower() in doc.issuer.lower():
                score = min(score + 0.2, 1.0)

            # Check expiry validity
            if req_doc.validity_rule and doc.expiry_date:
                today = date.today()
                if doc.expiry_date < today:
                    score = min(score, 0.5)  # Penalize expired docs

            if score > best_score and score >= 0.3:
                best_score = score
                best_doc = doc

        if best_doc:
            return {"document_id": best_doc.id, "score": best_score, "document": best_doc}
        return None

    def generate_report(self, procedure_id: str, company_id: str) -> MatchingReportResponse:
        """Generate a full matching report."""
        procedure = self.db.execute(
            select(Procedure).where(Procedure.id == procedure_id)
        ).scalar_one_or_none()
        if not procedure:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedura nuk u gjet")

        company = self.db.execute(
            select(Company).where(Company.id == company_id)
        ).scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kompania nuk u gjet")

        results = self.db.execute(
            select(MatchingResult).where(
                MatchingResult.procedure_id == procedure_id,
                MatchingResult.company_id == company_id,
            )
        ).scalars().all()

        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nuk ka rezultate ndeshje. Fillimisht ekzekutoni ndeshjen.",
            )

        # Build report items
        items = []
        found_valid = 0
        found_expired = 0
        found_partial = 0
        missing = 0
        review_required = 0

        for r in results:
            req_doc = self.db.execute(
                select(RequiredDocumentItem).where(RequiredDocumentItem.id == r.required_document_item_id)
            ).scalar_one_or_none()

            matched_doc = None
            if r.matched_document_id:
                matched_doc = self.db.execute(
                    select(Document).where(Document.id == r.matched_document_id)
                ).scalar_one_or_none()

            # Get retrieval guide
            retrieval_guide = self._get_retrieval_guide_text(req_doc.name if req_doc else "")

            item = MatchingReportItem(
                required_document_id=r.required_document_item_id,
                required_document_name=req_doc.name if req_doc else "E panjohur",
                category=req_doc.category if req_doc else "ADMINISTRATIVE",
                mandatory=req_doc.mandatory if req_doc else True,
                match_status=r.match_status,
                confidence_score=r.confidence_score,
                matched_document_id=r.matched_document_id,
                matched_document_title=matched_doc.title if matched_doc else None,
                notes=r.notes,
                retrieval_guide=retrieval_guide,
            )
            items.append(item)

            if r.match_status == MatchStatus.FOUND_VALID:
                found_valid += 1
            elif r.match_status == MatchStatus.FOUND_EXPIRED:
                found_expired += 1
            elif r.match_status == MatchStatus.FOUND_PARTIAL:
                found_partial += 1
            elif r.match_status == MatchStatus.MISSING:
                missing += 1
            elif r.match_status == MatchStatus.REVIEW_REQUIRED:
                review_required += 1

        total = len(results)
        readiness = (found_valid + found_partial * 0.5) / total * 100 if total > 0 else 0

        from datetime import datetime
        return MatchingReportResponse(
            procedure_id=procedure_id,
            company_id=company_id,
            company_name=company.name,
            procedure_reference=procedure.reference_no,
            authority_name=procedure.authority_name,
            total_required=total,
            found_valid=found_valid,
            found_expired=found_expired,
            found_partial=found_partial,
            missing=missing,
            review_required=review_required,
            readiness_score=round(readiness, 1),
            items=items,
            generated_at=datetime.utcnow(),
        )

    def _get_retrieval_guide_text(self, doc_name: str) -> Optional[str]:
        """Look for a retrieval guide for a given document type."""
        guide = self.db.execute(
            select(RetrievalGuide).where(
                RetrievalGuide.document_type.ilike(f"%{doc_name[:30]}%"),
                RetrievalGuide.is_active == True,
            )
        ).scalar_one_or_none()
        if guide:
            return guide.instructions
        return None

    def get_missing_docs_with_retrieval_guide(
        self, procedure_id: str, company_id: str
    ) -> list[dict]:
        """Get list of missing documents with retrieval instructions."""
        results = self.db.execute(
            select(MatchingResult).where(
                MatchingResult.procedure_id == procedure_id,
                MatchingResult.company_id == company_id,
                MatchingResult.match_status.in_([MatchStatus.MISSING, MatchStatus.FOUND_EXPIRED]),
            )
        ).scalars().all()

        missing_docs = []
        for r in results:
            req_doc = self.db.execute(
                select(RequiredDocumentItem).where(RequiredDocumentItem.id == r.required_document_item_id)
            ).scalar_one_or_none()
            if req_doc:
                guide = self._get_retrieval_guide_text(req_doc.name)
                missing_docs.append({
                    "required_document_id": req_doc.id,
                    "name": req_doc.name,
                    "category": req_doc.category,
                    "mandatory": req_doc.mandatory,
                    "issuer_type": req_doc.issuer_type,
                    "source_hint": req_doc.source_hint,
                    "validity_rule": req_doc.validity_rule,
                    "match_status": r.match_status,
                    "retrieval_guide": guide,
                })
        return missing_docs

    # RetrievalGuide CRUD
    def create_retrieval_guide(self, data: RetrievalGuideCreate) -> RetrievalGuide:
        guide = RetrievalGuide(
            document_type=data.document_type,
            issuing_authority=data.issuing_authority,
            source_channel=data.source_channel,
            instructions=data.instructions,
            validity_days=data.validity_days,
            notes=data.notes,
            is_active=data.is_active,
        )
        self.db.add(guide)
        self.db.commit()
        self.db.refresh(guide)
        return guide

    def list_retrieval_guides(self, active_only: bool = True) -> list[RetrievalGuide]:
        query = select(RetrievalGuide)
        if active_only:
            query = query.where(RetrievalGuide.is_active == True)
        return list(self.db.execute(query.order_by(RetrievalGuide.document_type)).scalars().all())
