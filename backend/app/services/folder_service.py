import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.folder import Folder, FolderType
from app.models.document import Document
from app.schemas.folder import FolderCreate, FolderUpdate, FolderTreeResponse

logger = logging.getLogger(__name__)

STANDARD_FOLDERS = [
    {"name": "01_Dokumente_Baze", "folder_type": FolderType.DOKUMENTE_BAZE, "sort_order": 1},
    {"name": "02_Certifikata", "folder_type": FolderType.CERTIFIKATA, "sort_order": 2},
    {"name": "03_Licenca", "folder_type": FolderType.LICENCA, "sort_order": 3},
    {"name": "04_Tatime_dhe_Sigurime", "folder_type": FolderType.TATIME_SIGURIME, "sort_order": 4},
    {"name": "05_Bilance", "folder_type": FolderType.BILANCE, "sort_order": 5},
    {"name": "06_Staf_Teknik", "folder_type": FolderType.STAF_TEKNIK, "sort_order": 6},
    {"name": "07_Referenca_Kontrata", "folder_type": FolderType.REFERENCA, "sort_order": 7},
    {"name": "08_Deklarata", "folder_type": FolderType.DEKLARATA, "sort_order": 8},
    {"name": "09_Dokumente_APP", "folder_type": FolderType.DOKUMENTE_APP, "sort_order": 9},
    {"name": "10_Analiza_AI", "folder_type": FolderType.ANALIZA_AI, "sort_order": 10},
]


class FolderService:
    def __init__(self, db: Session):
        self.db = db

    def create_standard_folders(self, company_id: str) -> list[Folder]:
        """Create all 10 standard folders for a new company."""
        folders = []
        for folder_data in STANDARD_FOLDERS:
            folder = Folder(
                company_id=company_id,
                name=folder_data["name"],
                folder_type=folder_data["folder_type"],
                sort_order=folder_data["sort_order"],
                path=f"/{folder_data['name']}",
                parent_id=None,
            )
            self.db.add(folder)
            folders.append(folder)
        self.db.flush()
        logger.info(f"Created {len(folders)} standard folders for company {company_id}")
        return folders

    def get_folder_tree(self, company_id: str) -> list[FolderTreeResponse]:
        """Get all folders as a tree structure."""
        folders = self.db.execute(
            select(Folder)
            .where(Folder.company_id == company_id)
            .order_by(Folder.sort_order, Folder.name)
        ).scalars().all()

        # Count documents per folder
        doc_counts = {}
        counts = self.db.execute(
            select(Document.folder_id, func.count(Document.id))
            .where(Document.company_id == company_id)
            .where(Document.folder_id.isnot(None))
            .group_by(Document.folder_id)
        ).all()
        for folder_id, count in counts:
            doc_counts[folder_id] = count

        folder_map = {}
        for folder in folders:
            f_dict = FolderTreeResponse(
                id=folder.id,
                company_id=folder.company_id,
                name=folder.name,
                folder_type=folder.folder_type,
                parent_id=folder.parent_id,
                path=folder.path,
                sort_order=folder.sort_order,
                created_at=folder.created_at,
                document_count=doc_counts.get(folder.id, 0),
                children=[],
            )
            folder_map[folder.id] = f_dict

        roots = []
        for folder in folders:
            f_resp = folder_map[folder.id]
            if folder.parent_id and folder.parent_id in folder_map:
                folder_map[folder.parent_id].children.append(f_resp)
            else:
                roots.append(f_resp)

        return roots

    def create_folder(self, company_id: str, data: FolderCreate) -> Folder:
        """Create a custom folder."""
        if data.parent_id:
            parent = self.db.execute(
                select(Folder).where(Folder.id == data.parent_id, Folder.company_id == company_id)
            ).scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dosja prind nuk u gjet")
            path = f"{parent.path}/{data.name}" if parent.path else f"/{data.name}"
        else:
            path = f"/{data.name}"

        folder = Folder(
            company_id=company_id,
            name=data.name,
            folder_type=data.folder_type,
            parent_id=data.parent_id,
            sort_order=data.sort_order,
            path=path,
        )
        self.db.add(folder)
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def get_folder(self, folder_id: str, company_id: Optional[str] = None) -> Folder:
        query = select(Folder).where(Folder.id == folder_id)
        if company_id:
            query = query.where(Folder.company_id == company_id)
        folder = self.db.execute(query).scalar_one_or_none()
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dosja nuk u gjet")
        return folder

    def update_folder(self, folder_id: str, company_id: str, data: FolderUpdate) -> Folder:
        folder = self.get_folder(folder_id, company_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(folder, key, value)
        if "name" in update_data:
            parent_path = ""
            if folder.parent_id:
                parent = self.db.execute(select(Folder).where(Folder.id == folder.parent_id)).scalar_one_or_none()
                if parent and parent.path:
                    parent_path = parent.path
            folder.path = f"{parent_path}/{folder.name}"
        self.db.commit()
        self.db.refresh(folder)
        return folder

    def delete_folder(self, folder_id: str, company_id: str) -> bool:
        folder = self.get_folder(folder_id, company_id)
        # Check if has documents
        doc_count = self.db.execute(
            select(func.count(Document.id)).where(Document.folder_id == folder_id)
        ).scalar()
        if doc_count and doc_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dosja ka {doc_count} dokument(e). Fshini dokumentet fillimisht.",
            )
        self.db.delete(folder)
        self.db.commit()
        return True

    def get_folder_with_doc_count(self, folder_id: str, company_id: Optional[str] = None) -> dict:
        folder = self.get_folder(folder_id, company_id)
        doc_count = self.db.execute(
            select(func.count(Document.id)).where(Document.folder_id == folder_id)
        ).scalar() or 0
        return {"folder": folder, "document_count": doc_count}
