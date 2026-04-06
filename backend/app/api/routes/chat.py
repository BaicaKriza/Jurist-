import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Session

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# DB Model for chat messages
# ---------------------------------------------------------------------------

class ChatMessage(Base):
        __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), index=True, nullable=False)
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    procedure_id = Column(String(36), nullable=True)
    company_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
        message: str
        procedure_id: Optional[str] = None
        company_id: Optional[str] = None
        session_id: Optional[str] = None
        stream: bool = True


# ---------------------------------------------------------------------------
# Helper: build context from procedure
# ---------------------------------------------------------------------------

def build_context(request: ChatRequest, db: Session) -> str:
        context_parts = []

    if request.procedure_id:
                try:
                                from app.models.procedure import Procedure, ProcedureUploadedDocument
                                from sqlalchemy import select

                    proc = db.execute(
                                        select(Procedure).where(Procedure.id == request.procedure_id)
                    ).scalar_one_or_none()

            if proc:
                                context_parts.append(
                                                        f"PROCEDURE:\n"
                                                        f"Reference: {proc.reference_no or 'N/A'}\n"
                                                        f"Authority: {proc.authority_name or 'N/A'}\n"
                                                        f"Description: {proc.object_description or 'N/A'}\n"
                                                        f"Status: {proc.status}\n"
                                                        f"Fund limit: {proc.fund_limit} {proc.currency or 'ALL'}\n"
                                                        f"Closing date: {proc.closing_date}"
                                )

                # Uploaded documents with extracted text
                                uploaded = db.execute(
                                    select(ProcedureUploadedDocument).where(
                                        ProcedureUploadedDocument.procedure_id == request.procedure_id,
                                        ProcedureUploadedDocument.is_deleted == False,
                                    )
                                ).scalars().all()

                for doc in uploaded[:3]:
                                        if doc.extracted_text:
                                                                    context_parts.append(
                                                                                                    f"\nDOCUMENT [{doc.doc_type}] {doc.title}:\n"
                                                                                                    f"{doc.extracted_text[:2000]}"
                                                                    )
except Exception as e:
            logger.warning(f"Context build failed for procedure {request.procedure_id}: {e}")

    if request.company_id:
                try:
                                from app.models.company import Company
                                from sqlalchemy import select

            company = db.execute(
                                select(Company).where(Company.id == int(request.company_id))
            ).scalar_one_or_none()

            if company:
                                context_parts.append(
                                                        f"COMPANY:\n"
                                                        f"Name: {company.name}\n"
                                                        f"NIPT: {getattr(company, 'nipt', 'N/A')}\n"
                                                        f"Activity: {getattr(company, 'activity', 'N/A')}"
                                )
except Exception as e:
            logger.warning(f"Context build failed for company {request.company_id}: {e}")

    return "\n\n".join(context_parts)


# ---------------------------------------------------------------------------
# SSE streaming helper
# ---------------------------------------------------------------------------

def event_stream(content: str):
        """Yield SSE events for the given content string."""
    for char in content:
                yield f"data: {json.dumps({'delta': char, 'done': False})}\n\n"
    yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/message")
async def chat_message(
        request: ChatRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
        session_id = request.session_id or str(uuid.uuid4())
    context = build_context(request, db)

    system_prompt = (
                "Ti jesh Jurist AI - asistent ekspert per prokurimet publike ne Shqiperi. "
                "Ndihmo perdoruesit te kuptojne procedurat e prokurimit, kerkesat ligjore, "
                "dhe dokumentacionin e nevojshem. Pergjigju ne shqip ose anglisht sipas gjuhes se pyetjes. "
                "Ji konciz, praktik dhe i sakte."
    )

    if context:
                system_prompt += f"\n\nKONTEKSTI AKTUAL:\n{context}"

    # Save user message
    user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=request.message,
                procedure_id=request.procedure_id,
                company_id=request.company_id,
    )
    db.add(user_msg)
    db.commit()

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
                # Mock response when no API key
                mock_response = (
                    "Jurist AI eshte aktiv! Per pergjigje reale, konfiguro OPENAI_API_KEY ne environment. "
                    f"Pyetja juaj: '{request.message}'"
    )
        assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=mock_response,
                        procedure_id=request.procedure_id,
                        company_id=request.company_id,
        )
        db.add(assistant_msg)
        db.commit()

        if request.stream:
                        return StreamingResponse(
                                            event_stream(mock_response),
                                            media_type="text/event-stream",
                                            headers={
                                                                    "Cache-Control": "no-cache",
                                                                    "X-Accel-Buffering": "no",
                                            },
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

                                                                    # Save assistant response
                                                                    assistant_msg = ChatMessage(
                                                                        session_id=session_id,
                                                                        role="assistant",
                                                                        content=full_response,
                                                                        procedure_id=request.procedure_id,
                                                                        company_id=request.company_id,
                                                                    )
                                                                    db.add(assistant_msg)
                                                                    db.commit()
except Exception as e:
                    logger.error(f"OpenAI streaming error: {e}")
                    yield f"data: {json.dumps({'delta': 'Gabim ne AI. Provoni serish.', 'done': True})}\n\n"

            return StreamingResponse(
                                generate(),
                                media_type="text/event-stream",
                                headers={
                                                        "Cache-Control": "no-cache",
                                                        "X-Accel-Buffering": "no",
                                },
            )
else:
            response = client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                                        {"role": "system", "content": system_prompt},
                                                        {"role": "user", "content": request.message},
                                ],
                                max_tokens=1000,
            )
            answer = response.choices[0].message.content or ""

            assistant_msg = ChatMessage(
                                session_id=session_id,
                                role="assistant",
                                content=answer,
                                procedure_id=request.procedure_id,
                                company_id=request.company_id,
            )
            db.add(assistant_msg)
            db.commit()
            return {"response": answer, "session_id": session_id}

except Exception as e:
        logger.error(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.get("/history/{session_id}")
def get_chat_history(
        session_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
):
        from sqlalchemy import select

    messages = db.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc())
    ).scalars().all()

    return [
                {
                                "id": m.id,
                                "role": m.role,
                                "content": m.content,
                                "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
    ]
