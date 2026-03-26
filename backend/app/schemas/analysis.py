from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.analysis import RiskLevel, DocumentCategory
from app.models.matching import MatchStatus


class ProcedureAnalysisResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    procedure_id: str
    analysis_type: str
    summary: Optional[str] = None
    legal_notes: Optional[str] = None
    technical_notes: Optional[str] = None
    financial_notes: Optional[str] = None
    risk_level: str
    recommended_action: Optional[str] = None
    ai_output_json: Optional[dict] = None
    created_at: datetime


class RequiredDocumentItemResponse(BaseModel):
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
    created_at: datetime


class MatchingResultResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    procedure_id: str
    company_id: str
    required_document_item_id: str
    matched_document_id: Optional[str] = None
    match_status: str
    confidence_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    required_document_name: Optional[str] = None
    required_document_category: Optional[str] = None
    matched_document_title: Optional[str] = None


class MatchingReportItem(BaseModel):
    required_document_id: str
    required_document_name: str
    category: str
    mandatory: bool
    match_status: str
    confidence_score: Optional[float] = None
    matched_document_id: Optional[str] = None
    matched_document_title: Optional[str] = None
    notes: Optional[str] = None
    retrieval_guide: Optional[str] = None


class MatchingReportResponse(BaseModel):
    procedure_id: str
    company_id: str
    company_name: str
    procedure_reference: Optional[str] = None
    authority_name: Optional[str] = None
    total_required: int
    found_valid: int
    found_expired: int
    found_partial: int
    missing: int
    review_required: int
    readiness_score: float
    items: list[MatchingReportItem]
    generated_at: datetime


class RetrievalGuideCreate(BaseModel):
    document_type: str = Field(min_length=2, max_length=255)
    issuing_authority: Optional[str] = Field(None, max_length=512)
    source_channel: Optional[str] = Field(None, max_length=255)
    instructions: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True


class RetrievalGuideResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    document_type: str
    issuing_authority: Optional[str] = None
    source_channel: Optional[str] = None
    instructions: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
