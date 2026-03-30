import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Text, Boolean, Integer, BigInteger, DateTime, Date, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
import enum


class DocumentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    ARCHIVED = "ARCHIVED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    folder_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    doc_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    issuer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reference_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        SAEnum(DocumentStatus, name="documentstatus"),
        nullable=False,
        default=DocumentStatus.ACTIVE,
        index=True,
    )
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="documents")  # noqa: F821
    folder: Mapped[Optional["Folder"]] = relationship("Folder", back_populates="documents")  # noqa: F821
    creator: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", back_populates="documents_created", foreign_keys=[created_by]
    )
    matching_results: Mapped[list["MatchingResult"]] = relationship(  # noqa: F821
        "MatchingResult", back_populates="matched_document", foreign_keys="MatchingResult.matched_document_id"
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} title={self.title} status={self.status}>"
