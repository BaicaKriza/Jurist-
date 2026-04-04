import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    nipt: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    legal_form: Mapped[str] = mapped_column(String(100), nullable=True)
    administrator_name: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    folders: Mapped[list["Folder"]] = relationship(  # noqa: F821
        "Folder", back_populates="company", cascade="all, delete-orphan",
        primaryjoin="Company.id == Folder.company_id"
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="company", cascade="all, delete-orphan"
    )
    matching_results: Mapped[list["MatchingResult"]] = relationship(  # noqa: F821
        "MatchingResult", back_populates="company", cascade="all, delete-orphan"
    )

    @property
    def status(self) -> str:
        if not self.is_active:
            return "inactive"
        return "active"

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name} nipt={self.nipt}>"
