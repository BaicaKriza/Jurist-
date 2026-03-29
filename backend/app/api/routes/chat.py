"""
Chat API – Jurist AI Assistant (SSE streaming).

POST /api/chat
  Body: { messages, company_id?, procedure_id? }
  Returns: text/event-stream  (each event: data: <text chunk>\n\n)
           or application/json when streaming is not accepted
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    company_id: Optional[str] = None
    procedure_id: Optional[str] = None


@router.post("", summary="Jurist AI chat (SSE streaming)")
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Stream an AI response for the given conversation.
    Response is Server-Sent Events: each chunk is `data: <text>\\n\\n`.
    Final event is `data: [DONE]\\n\\n`.
    """
    service = ChatService(db)
    msgs = [{"role": m.role, "content": m.content} for m in payload.messages]

    async def event_stream():
        try:
            async for chunk in service.stream_response(
                msgs,
                company_id=payload.company_id,
                procedure_id=payload.procedure_id,
            ):
                # Escape newlines inside a single SSE data field
                safe = chunk.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: [GABIM: {str(e)[:80]}]\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
