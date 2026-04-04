import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_current_superadmin
from app.models.user import User
from app.schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyListResponse,
    CompanyStatsResponse,
)
from app.services.company_service import CompanyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get(
    "",
    response_model=dict,
    summary="List companies with optional filters",
)
def list_companies(
    search: Optional[str] = Query(None, description="Search by name or NIPT"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Return a paginated list of companies, optionally filtered by name/NIPT or active status."""
    service = CompanyService(db)
    items, total = service.list_companies(
        search=search, is_active=is_active, page=page, page_size=page_size
    )
    return {
        "items": [CompanyListResponse.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post(
    "",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new company",
)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyResponse:
    """Create a new company and auto-generate its 10 standard document folders."""
    service = CompanyService(db)
    company = service.create_company(payload, creator_id=current_user.id)
    logger.info(f"Company '{company.name}' created by user {current_user.id}")
    return CompanyResponse.model_validate(company)


@router.get(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Get a company by ID",
)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CompanyResponse:
    """Retrieve full details for a single company."""
    service = CompanyService(db)
    company = service.get_company(company_id)
    return CompanyResponse.model_validate(company)


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Update a company",
)
def update_company(
    company_id: str,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CompanyResponse:
    """Update mutable fields of an existing company."""
    service = CompanyService(db)
    company = service.update_company(company_id, payload)
    return CompanyResponse.model_validate(company)


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a company (superadmin only)",
)
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> None:
    """Permanently delete a company and all its associated data. Requires superadmin."""
    service = CompanyService(db)
    service.delete_company(company_id)
    logger.info(f"Company {company_id} deleted")


@router.patch(
    "/{company_id}/deactivate",
    response_model=CompanyResponse,
    summary="Deactivate a company (soft delete)",
)
def deactivate_company(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> CompanyResponse:
    service = CompanyService(db)
    company = service.deactivate_company(company_id)
    logger.info(f"Company {company_id} deactivated")
    return CompanyResponse.model_validate(company)


@router.patch(
    "/{company_id}/activate",
    response_model=CompanyResponse,
    summary="Activate a company",
)
def activate_company(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> CompanyResponse:
    service = CompanyService(db)
    company = service.activate_company(company_id)
    logger.info(f"Company {company_id} activated")
    return CompanyResponse.model_validate(company)


@router.get(
    "/{company_id}/stats",
    response_model=CompanyStatsResponse,
    summary="Get document statistics for a company",
)
def get_company_stats(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CompanyStatsResponse:
    """Return counts of documents by status, expiry, and folder totals for a company."""
    service = CompanyService(db)
    return service.get_company_stats(company_id)
