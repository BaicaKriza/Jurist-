from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.folder import FolderType


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    folder_type: FolderType = FolderType.CUSTOM
    parent_id: Optional[str] = None
    sort_order: int = 0


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_type: Optional[FolderType] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None


class FolderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    company_id: str
    name: str
    folder_type: str
    parent_id: Optional[str] = None
    path: Optional[str] = None
    sort_order: int
    created_at: datetime
    document_count: int = 0


class FolderTreeResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    company_id: str
    name: str
    folder_type: str
    parent_id: Optional[str] = None
    path: Optional[str] = None
    sort_order: int
    created_at: datetime
    document_count: int = 0
    children: list["FolderTreeResponse"] = []


FolderTreeResponse.model_rebuild()
