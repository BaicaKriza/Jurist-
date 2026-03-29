"""
Chat service – Jurist AI Assistant.

Uses Anthropic Claude (primary) or OpenAI (fallback) to answer questions
about Albanian procurement procedures, document requirements, company readiness,
and general legal guidance.

Context injected per request:
- Company documents summary (if company_id provided)
- Recent procedures from DB
- Matching gaps (if company_id + procedure_id provided)
"""

import json
import logging
from typing import AsyncIterator, Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.models.procedure import Procedure
from app.models.document import Document, DocumentStatus
from app.models.analysis import RequiredDocumentItem

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ju jeni **Jurist AI** – asistent ligjor i specializuar në prokurimin publik shqiptar.

Ndihmoni përdoruesit me:
• Kërkesat ligjore sipas Ligjit Nr. 162/2020 "Për Prokurimin Publik"
• Dokumentacionin e nevojshëm për procedura prokurimi
• Analizën e procedurve dhe afateve
• Këshilla për plotësimin e dosjeve të ofertave
• Identifikimin e dokumenteve që mungojnë
• Interpretimin e kushteve të DST-ve

Stili juaj:
- Profesional por i qartë dhe i kuptueshëm
- Jepni përgjigje konkrete me hapa specifike
- Kur listoni dokumente, jepni edhe institucionin lëshues dhe vlefshmërinë
- Nëse keni kontekst specifik të kompanisë, përdoreni atë
- Gjithmonë tregoni nëse një informacion kërkon verifikim zyrtar

Gjuha: shqip (Albanian). Mund të pranoni pyetje edhe në anglisht por përgjigjuni gjithmonë në shqip."""


class ChatService:
    def __init__(self, db: Session):
        self.db = db

    def _build_context(
        self,
        company_id: Optional[str] = None,
        procedure_id: Optional[str] = None,
    ) -> str:
        """Build context string from DB for injection into the chat."""
        parts = []

        if company_id:
            docs = self.db.execute(
                select(Document).where(
                    Document.company_id == company_id,
                    Document.status != DocumentStatus.ARCHIVED,
                )
            ).scalars().all()

            if docs:
                doc_lines = []
                for d in docs[:20]:
                    expiry = f", skadon {d.expiry_date}" if d.expiry_date else ""
                    status = "⚠ E skaduar" if d.status == DocumentStatus.EXPIRED else "✓"
                    doc_lines.append(f"  {status} {d.title} [{d.doc_type or 'Lloj i panjohur'}]{expiry}")
                parts.append("DOKUMENTET E KOMPANISË:\n" + "\n".join(doc_lines))

        if procedure_id:
            proc = self.db.execute(
                select(Procedure).where(Procedure.id == procedure_id)
            ).scalar_one_or_none()
            if proc:
                parts.append(
                    f"PROCEDURA AKTIVE:\n"
                    f"  Autoriteti: {proc.authority_name or 'E panjohur'}\n"
                    f"  Objekti: {proc.object_description or 'N/A'}\n"
                    f"  Lloji: {proc.procedure_type or 'N/A'}\n"
                    f"  Fondi limit: {proc.fund_limit or 'N/A'} {proc.currency or 'ALL'}\n"
                    f"  Mbyllet: {proc.closing_date or 'N/A'}\n"
                    f"  Statusi: {proc.status}"
                )

            req_docs = self.db.execute(
                select(RequiredDocumentItem).where(
                    RequiredDocumentItem.procedure_id == procedure_id
                )
            ).scalars().all()
            if req_docs:
                req_lines = [
                    f"  - {r.name} [{r.category}] {'(Obligator)' if r.mandatory else '(Opsional)'}"
                    f"{' – ' + r.validity_rule if r.validity_rule else ''}"
                    for r in req_docs
                ]
                parts.append("DOKUMENTET E KËRKUARA:\n" + "\n".join(req_lines))

        return "\n\n".join(parts) if parts else ""

    async def stream_response(
        self,
        messages: list[dict],
        company_id: Optional[str] = None,
        procedure_id: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Stream chat response as SSE data chunks."""
        context = self._build_context(company_id, procedure_id)

        system = SYSTEM_PROMPT
        if context:
            system += f"\n\n---\nKONTEKSTI AKTUAL I SISTEMIT:\n{context}\n---"

        if settings.OPENAI_API_KEY:
            async for chunk in self._stream_openai(messages, system):
                yield chunk
        elif settings.ANTHROPIC_API_KEY:
            async for chunk in self._stream_anthropic(messages, system):
                yield chunk
        else:
            yield self._mock_response(messages)

    async def _stream_anthropic(
        self, messages: list[dict], system: str
    ) -> AsyncIterator[str]:
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            async with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                system=system,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Anthropic stream error: {e}")
            yield f"\n[Gabim: {str(e)[:100]}]"

    async def _stream_openai(
        self, messages: list[dict], system: str
    ) -> AsyncIterator[str]:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            stream = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": system}] + messages,
                max_tokens=1500,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            logger.error(f"OpenAI stream error: {e}")
            yield f"\n[Gabim: {str(e)[:100]}]"

    def _mock_response(self, messages: list[dict]) -> str:
        last = messages[-1]["content"] if messages else ""
        return (
            "Jurist AI është aktiv në modalitetin demo (pa API key).\n\n"
            f"Pyetja juaj: *\"{last[:100]}\"*\n\n"
            "Për përgjigje reale me AI, vendosni `ANTHROPIC_API_KEY` ose `OPENAI_API_KEY` "
            "në skedarin `backend/.env` dhe rindizni aplikacionin."
        )
