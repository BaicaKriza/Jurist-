from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.procedure import ProcedureSource, ProcedureStatus
from app.models.analysis import DocumentCategory


class ProcedureResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    source_name: str
    source_url: Optional[str] = None
    reference_no: Optional[str] = None
    notice_no: Optional[str] = None
    authority_name: Optional[str] = None
    object_description: Optional[str] = None
    procedure_type: Optional[str] = None
    contract_type: Optional[str] = None
    cpv_code: Optional[str] = None
    fund_limit: Optional[float] = None
    currency: Optional[str] = None
    publication_date: Optional[date] = None
    opening_date: Optional[date] = None
    closing_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime
    document_count: int = 0


class ProcedureDocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    procedure_id: str
    title: Optional[str] = None
    document_url: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    checksum: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime


class SyncRequest(BaseModel):
    source: Optional[str] = None  # "CONTRACT_NOTICE" | "SMALL_VALUE" | None for both
    max_pages: int = Field(default=5, ge=1, le=50)
    force_refresh: bool = False


class ProcedureSyncResponse(BaseModel):
    synced_count: int
    updated_count: int
    errors: int
    message: str
    source: Optional[str] = None


class ProcedureCreate(BaseModel):
    source_name: ProcedureSource = ProcedureSource.CONTRACT_NOTICE
    source_url: Optional[str] = Field(None, max_length=2048)
    reference_no: Optional[str] = Field(None, max_length=255)
    notice_no: Optional[str] = Field(None, max_length=255)
    authority_name: Optional[str] = Field(None, max_length=512)
    object_description: Optional[str] = None
    procedure_type: Optional[str] = Field(None, max_length=255)
    contract_type: Optional[str] = Field(None, max_length=100)
    cpv_code: Optional[str] = Field(None, max_length=50)
    fund_limit: Optional[float] = None
    currency: Optional[str] = Field("ALL", max_length=10)
    publication_date: Optional[date] = None
    opening_date: Optional[date] = None
    closing_date: Optional[date] = None
    status: Optional[ProcedureStatus] = ProcedureStatus.UNKNOWN


class RequiredDocumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    category: DocumentCategory = DocumentCategory.ADMINISTRATIVE
    description: Optional[str] = None
    mandatory: bool = True
    issuer_type: Optional[str] = Field(None, max_length=255)
    source_hint: Optional[str] = None
    validity_rule: Optional[str] = None


class RequiredDocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    procedure_id: str
    name: str
    category: str
    description: Optional[str] = None
    mandatory: bool
    issuer_type: Optional[str] = None
    source_hint: Optional[str] = None
    validity_rule: Optional[str] = None


class ProcedureFilterParams(BaseModel):
    source_name: Optional[str] = None
    status: Optional[str] = None
    authority_name: Optional[str] = None
    cpv_code: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
