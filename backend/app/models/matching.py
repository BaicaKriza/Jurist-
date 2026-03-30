import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Boolean, Float, Integer, DateTime, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class MatchStatus(str, enum.Enum):
    FOUND_VALID = "FOUND_VALID"
    FOUND_EXPIRED = "FOUND_EXPIRED"
    FOUND_PARTIAL = "FOUND_PARTIAL"
    MISSING = "MISSING"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class MatchingResult(Base):
    __tablename__ = "matching_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    required_document_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("required_document_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    matched_document_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    match_status: Mapped[str] = mapped_column(
        SAEnum(MatchStatus, name="matchstatus"),
        nullable=False,
        default=MatchStatus.MISSING,
        index=True,
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    procedure: Mapped["Procedure"] = relationship("Procedure", back_populates="matching_results")  # noqa: F821
    company: Mapped["Company"] = relationship("Company", back_populates="matching_results")  # noqa: F821
    required_document_item: Mapped["RequiredDocumentItem"] = relationship(  # noqa: F821
        "RequiredDocumentItem",
        back_populates="matching_results",
        foreign_keys=[required_document_item_id],
    )
    matched_document: Mapped[Optional["Document"]] = relationship(  # noqa: F821
        "Document",
        back_populates="matching_results",
        foreign_keys=[matched_document_id],
    )

    def __repr__(self) -> str:
        return f"<MatchingResult id={self.id} status={self.match_status}>"


class RetrievalGuide(Base):
    __tablename__ = "retrieval_guides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_type: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    issuing_authority: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    source_channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validity_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RetrievalGuide id={self.id} document_type={self.document_type}>"
