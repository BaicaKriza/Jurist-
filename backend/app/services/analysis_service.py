import json
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.procedure import Procedure
from app.models.analysis import ProcedureAnalysis, RequiredDocumentItem, RiskLevel, DocumentCategory
from app.core.config import settings

logger = logging.getLogger(__name__)


ANALYSIS_SYSTEM_PROMPT = """Ju jeni një jurist ekspert në prokurimet publike shqiptare.
Analizoni procedurën e prokurimit dhe jepni:
1. Një përmbledhje të qartë
2. Shënime ligjore (kërkesat ligjore, kushte minimale)
3. Shënime teknike (kualifikimet teknike të kërkuara)
4. Shënime financiare (kufiri i fondit, garancitë financiare)
5. Nivelin e rrezikut (LOW/MEDIUM/HIGH) me arsyetim
6. Veprimet e rekomanduara
7. Listën e dokumenteve të kërkuara me kategoritë (ADMINISTRATIVE/TECHNICAL/FINANCIAL/PROFESSIONAL)

Jepni përgjigjen në formatin JSON si më poshtë:
{
  "summary": "...",
  "legal_notes": "...",
  "technical_notes": "...",
  "financial_notes": "...",
  "risk_level": "LOW|MEDIUM|HIGH",
  "recommended_action": "...",
  "required_documents": [
    {
      "name": "...",
      "category": "ADMINISTRATIVE|TECHNICAL|FINANCIAL|PROFESSIONAL",
      "description": "...",
      "mandatory": true,
      "issuer_type": "...",
      "source_hint": "...",
      "validity_rule": "..."
    }
  ]
}"""


class AnalysisService:
    def __init__(self, db: Session):
        self.db = db

    async def analyze_procedure_with_ai(self, procedure: Procedure) -> ProcedureAnalysis:
        """Perform full AI analysis of a procedure.
        Provider priority: Anthropic Claude → OpenAI → mock.
        """
        if settings.ANTHROPIC_API_KEY:
            return await self._analyze_with_anthropic(procedure)
        if settings.OPENAI_API_KEY:
            return await self._analyze_with_openai(procedure)
        return self._create_mock_analysis(procedure)

    async def _analyze_with_anthropic(self, procedure: Procedure) -> ProcedureAnalysis:
        """Use Anthropic Claude (claude-sonnet-4-6) for analysis."""
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            procedure_text = self._build_procedure_text(procedure)

            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                system=ANALYSIS_SYSTEM_PROMPT + "\n\nPërgjigjuni VETËM me JSON të vlefshëm, pa tekst shtesë.",
                messages=[
                    {
                        "role": "user",
                        "content": f"Analizoni këtë procedurë prokurimi:\n\n{procedure_text}",
                    }
                ],
            )
            raw = message.content[0].text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            ai_data = json.loads(raw)
            logger.info(f"Anthropic analysis completed for procedure {procedure.id}")
            return self._save_analysis(procedure.id, ai_data, raw_json=ai_data)
        except Exception as e:
            logger.error(f"Anthropic analysis failed: {e}")
            return self._create_mock_analysis(procedure)

    async def _analyze_with_openai(self, procedure: Procedure) -> ProcedureAnalysis:
        """Use OpenAI GPT-4o-mini for analysis (fallback when no Anthropic key)."""
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            procedure_text = self._build_procedure_text(procedure)

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Analizoni këtë procedurë prokurimi:\n\n{procedure_text}"},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=3000,
            )
            raw = response.choices[0].message.content
            ai_data = json.loads(raw)
            logger.info(f"OpenAI analysis completed for procedure {procedure.id}")
            return self._save_analysis(procedure.id, ai_data, raw_json=ai_data)
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return self._create_mock_analysis(procedure)

    def _build_procedure_text(self, procedure: Procedure) -> str:
        parts = [
            f"Autoriteti Kontraktor: {procedure.authority_name or 'E panjohur'}",
            f"Objekti: {procedure.object_description or 'N/A'}",
            f"Lloji i Procedurës: {procedure.procedure_type or 'N/A'}",
            f"Lloji i Kontratës: {procedure.contract_type or 'N/A'}",
            f"Kodi CPV: {procedure.cpv_code or 'N/A'}",
            f"Kufiri i Fondit: {procedure.fund_limit or 'N/A'} {procedure.currency or 'ALL'}",
            f"Data e Publikimit: {procedure.publication_date or 'N/A'}",
            f"Data e Hapjes: {procedure.opening_date or 'N/A'}",
            f"Data e Mbylljes: {procedure.closing_date or 'N/A'}",
        ]
        if procedure.raw_json:
            extra = json.dumps(procedure.raw_json, ensure_ascii=False, indent=2)
            parts.append(f"\nTë dhëna shtesë:\n{extra}")
        return "\n".join(parts)

    def _create_mock_analysis(self, procedure: Procedure) -> ProcedureAnalysis:
        """Create a template analysis when AI is unavailable."""
        mock_data = {
            "summary": f"Procedurë prokurimi nga {procedure.authority_name or 'autoriteti kontraktor'} "
                       f"për: {procedure.object_description or 'objekt i papërcaktuar'}. "
                       f"Kufiri i fondit: {procedure.fund_limit or 'N/A'} {procedure.currency or 'ALL'}.",
            "legal_notes": "Kërkohen dokumentet ligjore sipas Ligjit Nr. 162/2020 'Për Prokurimin Publik'.",
            "technical_notes": "Operatori ekonomik duhet të plotësojë kërkesat teknike të specifikiuara në DST.",
            "financial_notes": f"Fondi limit: {procedure.fund_limit or 'N/A'} {procedure.currency or 'ALL'}. "
                               "Kërkohet garancë oferte dhe ekzekutimi sipas VKM.",
            "risk_level": "MEDIUM",
            "recommended_action": "Shqyrtoni me kujdes kriteret e kualifikimit dhe sigurohuni që dokumentacioni është i plotë.",
            "required_documents": [
                {
                    "name": "Certifikatë Regjistrimi NUIS/NIPT",
                    "category": "ADMINISTRATIVE",
                    "description": "Certifikatë aktive e regjistrimit të biznesit",
                    "mandatory": True,
                    "issuer_type": "QKB",
                    "source_hint": "Qendra Kombëtare e Biznesit - qkb.gov.al",
                    "validity_rule": "E vlefshme"
                },
                {
                    "name": "Deklaratë e Gjendjes Gjyqësore",
                    "category": "ADMINISTRATIVE",
                    "description": "Dëshmi penaliteti për administratorin",
                    "mandatory": True,
                    "issuer_type": "Gjykata",
                    "source_hint": "Gjykata e rrethit gjyqësor",
                    "validity_rule": "Jo më e vjetër se 3 muaj"
                },
                {
                    "name": "Vërtetim Tatimor",
                    "category": "FINANCIAL",
                    "description": "Dëshmi për shlyerjen e detyrimeve tatimore",
                    "mandatory": True,
                    "issuer_type": "DRT",
                    "source_hint": "Drejtoria Rajonale e Tatimeve",
                    "validity_rule": "Jo më e vjetër se 3 muaj"
                },
                {
                    "name": "Vërtetim Sigurimesh",
                    "category": "FINANCIAL",
                    "description": "Dëshmi për shlyerjen e detyrimeve të sigurimeve shoqërore",
                    "mandatory": True,
                    "issuer_type": "ISSH",
                    "source_hint": "Instituti i Sigurimeve Shoqërore",
                    "validity_rule": "Jo më e vjetër se 3 muaj"
                },
                {
                    "name": "Bilanci Kontabël",
                    "category": "FINANCIAL",
                    "description": "Bilanci i vitit të fundit fiskal i audituar",
                    "mandatory": True,
                    "issuer_type": "Auditues i certifikuar",
                    "source_hint": "Kontabilist i licencuar",
                    "validity_rule": "Viti i fundit fiskal"
                },
            ],
        }
        return self._save_analysis(procedure.id, mock_data, raw_json=mock_data)

    def _save_analysis(self, procedure_id: str, ai_data: dict, raw_json: dict) -> ProcedureAnalysis:
        # Remove existing analysis
        existing = self.db.execute(
            select(ProcedureAnalysis).where(ProcedureAnalysis.procedure_id == procedure_id)
        ).scalars().all()
        for e in existing:
            self.db.delete(e)

        # Remove existing required documents
        existing_docs = self.db.execute(
            select(RequiredDocumentItem).where(RequiredDocumentItem.procedure_id == procedure_id)
        ).scalars().all()
        for e in existing_docs:
            self.db.delete(e)

        self.db.flush()

        risk_level = ai_data.get("risk_level", "MEDIUM")
        if risk_level not in [r.value for r in RiskLevel]:
            risk_level = "MEDIUM"

        analysis = ProcedureAnalysis(
            procedure_id=procedure_id,
            analysis_type="FULL",
            summary=ai_data.get("summary"),
            legal_notes=ai_data.get("legal_notes"),
            technical_notes=ai_data.get("technical_notes"),
            financial_notes=ai_data.get("financial_notes"),
            risk_level=risk_level,
            recommended_action=ai_data.get("recommended_action"),
            ai_output_json=raw_json,
        )
        self.db.add(analysis)

        # Save required document items
        for req_doc in ai_data.get("required_documents", []):
            cat = req_doc.get("category", "ADMINISTRATIVE")
            if cat not in [c.value for c in DocumentCategory]:
                cat = "ADMINISTRATIVE"
            item = RequiredDocumentItem(
                procedure_id=procedure_id,
                name=req_doc.get("name", ""),
                category=cat,
                description=req_doc.get("description"),
                mandatory=req_doc.get("mandatory", True),
                issuer_type=req_doc.get("issuer_type"),
                source_hint=req_doc.get("source_hint"),
                validity_rule=req_doc.get("validity_rule"),
            )
            self.db.add(item)

        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def get_analyses(self, page: int = 1, page_size: int = 20) -> tuple[list[ProcedureAnalysis], int]:
        from sqlalchemy import func
        total = self.db.execute(select(func.count(ProcedureAnalysis.id))).scalar() or 0
        analyses = self.db.execute(
            select(ProcedureAnalysis)
            .order_by(ProcedureAnalysis.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).scalars().all()
        return list(analyses), total

    def get_analysis(self, analysis_id: str) -> ProcedureAnalysis:
        analysis = self.db.execute(
            select(ProcedureAnalysis).where(ProcedureAnalysis.id == analysis_id)
        ).scalar_one_or_none()
        if not analysis:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analiza nuk u gjet")
        return analysis

    def get_required_documents(self, procedure_id: str) -> list[RequiredDocumentItem]:
        return list(self.db.execute(
            select(RequiredDocumentItem).where(RequiredDocumentItem.procedure_id == procedure_id)
        ).scalars().all())

    def generate_summary(self, text: str) -> Optional[str]:
        """Generate a summary of given text using AI. Claude → OpenAI → truncate."""
        if settings.ANTHROPIC_API_KEY:
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                msg = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=500,
                    messages=[
                        {
                            "role": "user",
                            "content": f"Bëni një përmbledhje të shkurtër të dokumentit në shqip:\n\n{text[:4000]}",
                        }
                    ],
                )
                return msg.content[0].text
            except Exception as e:
                logger.error(f"Anthropic summary failed: {e}")

        if settings.OPENAI_API_KEY:
            try:
                import openai
                client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Bëni një përmbledhje të shkurtër të dokumentit në shqip."},
                        {"role": "user", "content": text[:4000]},
                    ],
                    max_tokens=500,
                    temperature=0.3,
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI summary failed: {e}")

        return text[:500] + "..." if len(text) > 500 else text
