import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_superadmin, hash_password
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.document import Document
from app.models.procedure import Procedure
from app.models.analysis import ProcedureAnalysis
from app.models.role import Role, UserRole
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _build_user_response(user: User, db: Session) -> UserResponse:
    role_names: List[str] = db.execute(
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
    ).scalars().all()
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        is_superadmin=user.is_superadmin,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=list(role_names),
    )


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get(
    "/users",
    response_model=dict,
    summary="List all users (superadmin only)",
)
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> dict:
    """Return a paginated list of all user accounts. Requires superadmin."""
    query = select(User)
    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar() or 0

    users = db.execute(
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [_build_user_response(u, db) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (superadmin only)",
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> UserResponse:
    """Create a new user account with optional role assignments. Requires superadmin."""
    existing = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' është tashmë i regjistruar",
        )

    new_user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_superadmin=payload.is_superadmin,
    )
    db.add(new_user)
    db.flush()

    for role_name in payload.role_names:
        role = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
        if role:
            db.add(UserRole(user_id=new_user.id, role_id=role.id))
        else:
            logger.warning(f"Role '{role_name}' not found; skipping assignment for new user")

    db.commit()
    db.refresh(new_user)
    logger.info(f"Admin created user: {new_user.email}")
    return _build_user_response(new_user, db)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update a user (superadmin only)",
)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> UserResponse:
    """Update a user's profile fields or role assignments. Requires superadmin."""
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Përdoruesi nuk u gjet")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle role updates separately
    role_names = update_data.pop("role_names", None)

    # Check email uniqueness if being changed
    if "email" in update_data and update_data["email"] != user.email:
        existing = db.execute(
            select(User).where(User.email == update_data["email"])
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{update_data['email']}' është tashmë i zënë",
            )

    for key, value in update_data.items():
        setattr(user, key, value)

    if role_names is not None:
        # Remove all existing roles and reassign
        existing_user_roles = db.execute(
            select(UserRole).where(UserRole.user_id == user_id)
        ).scalars().all()
        for ur in existing_user_roles:
            db.delete(ur)
        db.flush()

        for role_name in role_names:
            role = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
            if role:
                db.add(UserRole(user_id=user.id, role_id=role.id))
            else:
                logger.warning(f"Role '{role_name}' not found during update; skipping")

    db.commit()
    db.refresh(user)
    logger.info(f"Admin updated user: {user.email}")
    return _build_user_response(user, db)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a user (superadmin only)",
)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_superadmin),
) -> None:
    """Deactivate (soft-delete) a user account so they can no longer log in. Requires superadmin."""
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nuk mund të çaktivizoni llogarinë tuaj",
        )

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Përdoruesi nuk u gjet")

    user.is_active = False
    db.commit()
    logger.info(f"Admin deactivated user: {user.email}")


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get(
    "/audit-logs",
    response_model=dict,
    summary="List audit logs (superadmin only)",
)
def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> dict:
    """Return a paginated list of audit log entries. Requires superadmin."""
    query = select(AuditLog)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar() or 0

    logs = db.execute(
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    items = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details_json": log.details_json,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get(
    "/stats",
    response_model=dict,
    summary="Dashboard statistics (superadmin only)",
)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> dict:
    """Return high-level counts of companies, documents, procedures and analyses for the dashboard."""
    total_companies = db.execute(select(func.count(Company.id))).scalar() or 0
    active_companies = db.execute(
        select(func.count(Company.id)).where(Company.is_active == True)
    ).scalar() or 0

    total_documents = db.execute(select(func.count(Document.id))).scalar() or 0
    total_procedures = db.execute(select(func.count(Procedure.id))).scalar() or 0
    total_analyses = db.execute(select(func.count(ProcedureAnalysis.id))).scalar() or 0
    total_users = db.execute(select(func.count(User.id))).scalar() or 0
    active_users = db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    ).scalar() or 0

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_documents": total_documents,
        "total_procedures": total_procedures,
        "total_analyses": total_analyses,
        "total_users": total_users,
        "active_users": active_users,
    }
