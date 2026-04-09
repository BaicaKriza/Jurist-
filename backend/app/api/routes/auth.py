import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_superadmin,
    get_current_user,
    hash_password,
    verify_password,
    verify_token,
)
from app.models.role import Role, UserRole
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, RefreshRequest, TokenResponse, UserCreate, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


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


def _authenticate_user(email: str, password: str, db: Session) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ose fjalekalim i gabuar",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Llogaria eshte e caktivizuar",
        )
    return user


def _make_token_response(user: User) -> TokenResponse:
    token_data = {"sub": user.id, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login - accepts JSON body or form-urlencoded",
)
async def login(request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        email = str(body.get("email") or body.get("username") or "")
        password = str(body.get("password") or "")
    else:
        form = await request.form()
        email = str(form.get("email") or form.get("username") or "")
        password = str(form.get("password") or "")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="email dhe password jane te detyrueshme",
        )

    user = _authenticate_user(email, password, db)
    logger.info("User %s logged in", user.email)
    return _make_token_response(user)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="OAuth2 form login (Swagger UI compatible)",
)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = _authenticate_user(form_data.username, form_data.password, db)
    logger.info("User %s logged in via OAuth2", user.email)
    return _make_token_response(user)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token_payload = verify_token(payload.refresh_token, token_type="refresh")
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token i pavlefshem ose i skaduar",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(token_payload.get("sub") or "")
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Perdoruesi nuk u gjet ose eshte i caktivizuar",
        )

    return _make_token_response(user)


@router.get("/me", response_model=UserResponse, summary="Get current user info")
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
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
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' eshte tashme i regjistruar",
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

    db.commit()
    db.refresh(new_user)
    logger.info("New user registered: %s", new_user.email)
    return _build_user_response(new_user, db)


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT, summary="Change own password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fjalekalimi aktual eshte i gabuar",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    logger.info("Password changed for user %s", current_user.email)
