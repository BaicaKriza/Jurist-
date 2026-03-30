import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
import enum


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class DocumentCategory(str, enum.Enum):
    ADMINISTRATIVE = "ADMINISTRATIVE"
    TECHNICAL = "TECHNICAL"
    FINANCIAL = "FINANCIAL"
    PROFESSIONAL = "PROFESSIONAL"


class ProcedureAnalysis(Base):
    __tablename__ = "procedure_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    analysis_type: Mapped[str] = mapped_column(String(100), nullable=False, default="FULL")
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    legal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    financial_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(
        SAEnum(RiskLevel, name="risklevel"), nullable=False, default=RiskLevel.MEDIUM
    )
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_output_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    procedure: Mapped["Procedure"] = relationship("Procedure", back_populates="analyses")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ProcedureAnalysis id={self.id} procedure_id={self.procedure_id}>"


class RequiredDocumentItem(Base):
    __tablename__ = "required_document_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[str] = mapped_column(
        SAEnum(DocumentCategory, name="documentcategory"),
        nullable=False,
        default=DocumentCategory.ADMINISTRATIVE,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    issuer_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_hint: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    validity_rule: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    procedure: Mapped["Procedure"] = relationship("Procedure", back_populates="required_documents")  # noqa: F821
    matching_results: Mapped[list["MatchingResult"]] = relationship(  # noqa: F821
        "MatchingResult",
        back_populates="required_document_item",
        foreign_keys="MatchingResult.required_document_item_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<RequiredDocumentItem id={self.id} name={self.name}>"
