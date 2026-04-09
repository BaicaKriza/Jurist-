import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text, select
from sqlalchemy.orm import Session

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), index=True, nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    procedure_id = Column(String(36), nullable=True)
    company_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatRequest(BaseModel):
    message: str
    procedure_id: Optional[str] = None
    company_id: Optional[str] = None
    session_id: Optional[str] = None
    stream: bool = True


def build_context(request: ChatRequest, db: Session) -> str:
    context_parts: list[str] = []

    if request.procedure_id:
        try:
            from app.models.procedure import Procedure, ProcedureUploadedDocument

            procedure = db.execute(
                select(Procedure).where(Procedure.id == request.procedure_id)
            ).scalar_one_or_none()
            if procedure:
                context_parts.append(
                    "PROCEDURE:\n"
                    f"Reference: {procedure.reference_no or 'N/A'}\n"
                    f"Authority: {procedure.authority_name or 'N/A'}\n"
                    f"Description: {procedure.object_description or 'N/A'}\n"
                    f"Status: {procedure.status}\n"
                    f"Fund limit: {procedure.fund_limit} {procedure.currency or 'ALL'}\n"
                    f"Closing date: {procedure.closing_date}"
                )

            uploaded_docs = db.execute(
                select(ProcedureUploadedDocument).where(
                    ProcedureUploadedDocument.procedure_id == request.procedure_id,
                    ProcedureUploadedDocument.is_deleted.is_(False),
                )
            ).scalars().all()

            for document in uploaded_docs[:3]:
                if document.extracted_text:
                    context_parts.append(
                        f"\nDOCUMENT [{document.doc_type}] {document.title}:\n"
                        f"{document.extracted_text[:2000]}"
                    )
        except Exception as exc:
            logger.warning("Context build failed for procedure %s: %s", request.procedure_id, exc)

    if request.company_id:
        try:
            from app.models.company import Company

            company = db.execute(
                select(Company).where(Company.id == request.company_id)
            ).scalar_one_or_none()
            if company:
                context_parts.append(
                    "COMPANY:\n"
                    f"Name: {company.name}\n"
                    f"NIPT: {getattr(company, 'nipt', 'N/A')}\n"
                    f"Activity: {getattr(company, 'activity', 'N/A')}"
                )
        except Exception as exc:
            logger.warning("Context build failed for company %s: %s", request.company_id, exc)

    return "\n\n".join(context_parts)


def event_stream(content: str):
    for char in content:
        yield f"data: {json.dumps({'delta': char, 'done': False})}\n\n"
    yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_id = request.session_id or str(uuid.uuid4())
    context = build_context(request, db)

    system_prompt = (
        "Ti je Jurist AI - asistent ekspert per prokurimet publike ne Shqiperi. "
        "Ndihmo perdoruesit te kuptojne procedurat e prokurimit, kerkesat ligjore, "
        "dhe dokumentacionin e nevojshem. Pergjigju ne shqip ose anglisht sipas gjuhes se pyetjes. "
        "Ji konciz, praktik dhe i sakte."
    )
    if context:
        system_prompt += f"\n\nKONTEKSTI AKTUAL:\n{context}"

    db.add(
        ChatMessage(
            session_id=session_id,
            role="user",
            content=request.message,
            procedure_id=request.procedure_id,
            company_id=request.company_id,
        )
    )
    db.commit()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        mock_response = (
            "Jurist AI eshte aktiv! Per pergjigje reale, konfiguro OPENAI_API_KEY ne environment. "
            f"Pyetja juaj: '{request.message}'"
        )
        db.add(
            ChatMessage(
                session_id=session_id,
                role="assistant",
                content=mock_response,
                procedure_id=request.procedure_id,
                company_id=request.company_id,
            )
        )
        db.commit()

        if request.stream:
            return StreamingResponse(
                event_stream(mock_response),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        return {"response": mock_response, "session_id": session_id}

    try:
        import openai

        client = openai.OpenAI(api_key=api_key)

        if request.stream:
            def generate():
                full_response = ""
                try:
                    stream = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": request.message},
                        ],
                        stream=True,
                        max_tokens=1000,
                    )
                    for chunk in stream:
                        delta = chunk.choices[0].delta.content or ""
                        if delta:
                            full_response += delta
                            yield f"data: {json.dumps({'delta': delta, 'done': False})}\n\n"
                    yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"

                    db.add(
                        ChatMessage(
                            session_id=session_id,
                            role="assistant",
                            content=full_response,
                            procedure_id=request.procedure_id,
                            company_id=request.company_id,
                        )
                    )
                    db.commit()
                except Exception as exc:
                    logger.error("OpenAI streaming error: %s", exc)
                    yield f"data: {json.dumps({'delta': 'Gabim ne AI. Provoni serish.', 'done': True})}\n\n"

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            max_tokens=1000,
        )
        answer = response.choices[0].message.content or ""

        db.add(
            ChatMessage(
                session_id=session_id,
                role="assistant",
                content=answer,
                procedure_id=request.procedure_id,
                company_id=request.company_id,
            )
        )
        db.commit()
        return {"response": answer, "session_id": session_id}
    except Exception as exc:
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=500, detail=f"AI service error: {str(exc)}") from exc


@router.get("/history/{session_id}")
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    messages = db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    ).scalars().all()

    return [
        {
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat() if message.created_at else None,
        }
        for message in messages
    ]
