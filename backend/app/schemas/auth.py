from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    is_superadmin: bool = False
    role_names: list[str] = []


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    full_name: str
    email: str
    is_active: bool
    is_superadmin: bool
    created_at: datetime
    updated_at: datetime
    roles: list[str] = []


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_superadmin: Optional[bool] = None
    role_names: Optional[list[str]] = None
