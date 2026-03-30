import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class FolderType(str, enum.Enum):
    DOKUMENTE_BAZE = "DOKUMENTE_BAZE"
    CERTIFIKATA = "CERTIFIKATA"
    LICENCA = "LICENCA"
    TATIME_SIGURIME = "TATIME_SIGURIME"
    BILANCE = "BILANCE"
    STAF_TEKNIK = "STAF_TEKNIK"
    REFERENCA = "REFERENCA"
    DEKLARATA = "DEKLARATA"
    DOKUMENTE_APP = "DOKUMENTE_APP"
    ANALIZA_AI = "ANALIZA_AI"
    CUSTOM = "CUSTOM"


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    folder_type: Mapped[str] = mapped_column(
        SAEnum(FolderType, name="foldertype"), nullable=False, default=FolderType.CUSTOM
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    path: Mapped[str] = mapped_column(String(1024), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    company: Mapped["Company"] = relationship(  # noqa: F821
        "Company", back_populates="folders", foreign_keys=[company_id]
    )
    parent: Mapped["Folder | None"] = relationship(
        "Folder", back_populates="children", remote_side="Folder.id", foreign_keys=[parent_id]
    )
    children: Mapped[list["Folder"]] = relationship(
        "Folder", back_populates="parent", foreign_keys=[parent_id], cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="folder"
    )

    def __repr__(self) -> str:
        return f"<Folder id={self.id} name={self.name} type={self.folder_type}>"
