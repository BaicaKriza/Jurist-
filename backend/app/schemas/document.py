from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime, date
from app.models.document import DocumentStatus


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    doc_type: Optional[str] = Field(None, max_length=100)
    issuer: Optional[str] = Field(None, max_length=255)
    reference_no: Optional[str] = Field(None, max_length=255)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    folder_id: Optional[str] = None
    metadata_json: Optional[dict] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    doc_type: Optional[str] = Field(None, max_length=100)
    issuer: Optional[str] = Field(None, max_length=255)
    reference_no: Optional[str] = Field(None, max_length=255)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    folder_id: Optional[str] = None
    status: Optional[DocumentStatus] = None
    metadata_json: Optional[dict] = None


class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    company_id: str
    company: Optional[dict] = None
    folder_id: Optional[str] = None
    title: str
    doc_type: Optional[str] = None
    issuer: Optional[str] = None
    reference_no: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    file_name: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    checksum: Optional[str] = None
    version_no: int
    status: str
    ai_summary: Optional[str] = None
    metadata_json: Optional[dict] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    download_url: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    id: str
    title: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    status: str
    message: str = "Dokumenti u ngarkua me sukses"


class ExpiryAlertResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    company_id: str
    company_name: str
    title: str
    expiry_date: Optional[date] = None
    days_until_expiry: int
    status: str
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
