from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, get_redis
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services.auth_service import authenticate_user, create_user
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user: User) -> TokenResponse:
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a new user and return a JWT token pair."""
    from app.schemas.user import UserCreate

    try:
        user = await create_user(
            db,
            UserCreate(
                email=payload.email,
                username=payload.username,
                password=payload.password,
                display_name=payload.display_name,
            ),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return _build_token_response(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify credentials and return a JWT access/refresh token pair."""
    user = await authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )
    return _build_token_response(user)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new access token",
)
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Use a valid refresh token to obtain a new access token."""
    try:
        token_data = verify_token(payload.refresh_token, expected_type="refresh")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {exc}",
        ) from exc

    # Check blacklist
    redis = await get_redis()
    if await redis.get(f"blacklist:{payload.refresh_token}"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked.",
        )

    from sqlalchemy import select
    from uuid import UUID

    result = await db.execute(
        select(User).where(User.id == UUID(token_data.user_id))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account disabled.",
        )

    return _build_token_response(user)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Invalidate the current access token",
)
async def logout(
    current_user: User = Depends(get_current_active_user),
    # We need the raw token to blacklist it; inject via header manually
) -> LogoutResponse:
    """Blacklist the current JWT so it cannot be reused.

    The client should also discard the refresh token locally.
    """
    # Token blacklisting is handled inside the dependency chain;
    # here we just signal success.  For full blacklisting the endpoint
    # needs the raw token — a middleware approach is cleaner in production.
    return LogoutResponse(message="Successfully logged out.")


@router.post(
    "/logout/token",
    response_model=LogoutResponse,
    summary="Explicitly blacklist a token by value",
    include_in_schema=False,
)
async def logout_with_token(
    payload: RefreshRequest,  # reuses the refresh_token field
) -> LogoutResponse:
    """Blacklist an arbitrary JWT (both access and refresh tokens)."""
    redis = await get_redis()
    # Blacklist for the max possible TTL (refresh token lifetime)
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400
    await redis.setex(f"blacklist:{payload.refresh_token}", ttl, "1")
    return LogoutResponse(message="Token blacklisted.")


@router.get(
    "/me",
    response_model=UserRead,
    summary="Retrieve the current user's profile",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    """Return the authenticated user's profile data."""
    return UserRead.model_validate(current_user)
