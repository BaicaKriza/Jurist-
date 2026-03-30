import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Text, Numeric, DateTime, Date, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
import enum


class ProcedureSource(str, enum.Enum):
    CONTRACT_NOTICE = "CONTRACT_NOTICE"
    SMALL_VALUE = "SMALL_VALUE"


class ProcedureStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    AWARDED = "AWARDED"
    CANCELLED = "CANCELLED"
    UNKNOWN = "UNKNOWN"


class Procedure(Base):
    __tablename__ = "procedures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_name: Mapped[str] = mapped_column(
        SAEnum(ProcedureSource, name="proceduresource"), nullable=False, index=True
    )
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    reference_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    notice_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    authority_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, index=True)
    object_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    procedure_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contract_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cpv_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    fund_limit: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="ALL")
    publication_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    opening_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    closing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        SAEnum(ProcedureStatus, name="procedurestatus"),
        nullable=False,
        default=ProcedureStatus.UNKNOWN,
        index=True,
    )
    raw_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    procedure_documents: Mapped[list["ProcedureDocument"]] = relationship(
        "ProcedureDocument", back_populates="procedure", cascade="all, delete-orphan"
    )
    analyses: Mapped[list["ProcedureAnalysis"]] = relationship(  # noqa: F821
        "ProcedureAnalysis", back_populates="procedure", cascade="all, delete-orphan"
    )
    required_documents: Mapped[list["RequiredDocumentItem"]] = relationship(  # noqa: F821
        "RequiredDocumentItem", back_populates="procedure", cascade="all, delete-orphan"
    )
    matching_results: Mapped[list["MatchingResult"]] = relationship(  # noqa: F821
        "MatchingResult", back_populates="procedure", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Procedure id={self.id} ref={self.reference_no} source={self.source_name}>"


class ProcedureDocument(Base):
    __tablename__ = "procedure_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    procedure: Mapped["Procedure"] = relationship("Procedure", back_populates="procedure_documents")

    def __repr__(self) -> str:
        return f"<ProcedureDocument id={self.id} title={self.title}>"
