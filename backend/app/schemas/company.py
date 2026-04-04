from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    nipt: str = Field(min_length=3, max_length=20)
    legal_form: Optional[str] = Field(None, max_length=100)
    administrator_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    nipt: Optional[str] = Field(None, min_length=3, max_length=20)
    legal_form: Optional[str] = Field(None, max_length=100)
    administrator_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    nipt: str
    legal_form: Optional[str] = None
    administrator_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    status: str
    created_at: datetime
    updated_at: datetime


class CompanyStatsResponse(BaseModel):
    company_id: str
    company_name: str
    total_documents: int
    active_documents: int
    expired_documents: int
    review_required: int
    expiring_soon: int
    total_folders: int


class CompanyListResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    nipt: str
    legal_form: Optional[str] = None
    administrator_name: Optional[str] = None
    is_active: bool
    status: str
    created_at: datetime
    document_count: int = 0
    expired_count: int = 0
