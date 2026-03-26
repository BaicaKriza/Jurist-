import logging
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    get_current_superadmin,
)
from app.core.config import settings
from app.models.user import User
from app.models.role import Role, UserRole
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserCreate,
    UserResponse,
    ChangePasswordRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_user_response(user: User, db: Session) -> UserResponse:
    """Build a UserResponse including role names."""
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


@router.post("/login", response_model=TokenResponse, summary="Login with email and password")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate a user and return JWT access + refresh tokens."""
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ose fjalëkalim i gabuar",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Llogaria është e çaktivizuar",
        )

    token_data = {"sub": user.id, "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info(f"User {user.email} logged in successfully")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Exchange a valid refresh token for a new access token."""
    token_payload = verify_token(payload.refresh_token, token_type="refresh")
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token i pavlefshëm ose i skaduar",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = token_payload.get("sub")
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Përdoruesi nuk u gjet ose është i çaktivizuar",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {"sub": user.id, "email": user.email}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse, summary="Get current user info")
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return _build_user_response(current_user, db)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (superadmin only)",
)
def register_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_superadmin),
) -> UserResponse:
    """Create a new user account. Requires superadmin privileges."""
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

    # Assign requested roles
    for role_name in payload.role_names:
        role = db.execute(
            select(Role).where(Role.name == role_name)
        ).scalar_one_or_none()
        if role:
            db.add(UserRole(user_id=new_user.id, role_id=role.id))
        else:
            logger.warning(f"Role '{role_name}' not found; skipping assignment")

    db.commit()
    db.refresh(new_user)
    logger.info(f"New user registered: {new_user.email}")
    return _build_user_response(new_user, db)


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT, summary="Change own password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Allow the authenticated user to change their own password."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fjalëkalimi aktual është i gabuar",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    logger.info(f"Password changed for user {current_user.email}")
