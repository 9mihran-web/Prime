from __future__ import annotations

from typing import AsyncGenerator, Optional
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import verify_token
from app.models.user import User

# ---------------------------------------------------------------------------
# Bearer token scheme
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Redis client (shared singleton)
# ---------------------------------------------------------------------------

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


# ---------------------------------------------------------------------------
# Token extraction helpers
# ---------------------------------------------------------------------------

def _extract_token(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> str:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


async def _load_user_from_token(
    token: str,
    db: AsyncSession,
) -> User:
    """Decode *token*, check it is not blacklisted, and fetch the user row."""
    try:
        token_data = verify_token(token, expected_type="access")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Check token blacklist (logout)
    redis = await get_redis()
    blacklisted = await redis.get(f"blacklist:{token}")
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User).where(User.id == UUID(token_data.user_id))
    )
    user: Optional[User] = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the Bearer JWT; return the associated :class:`User`."""
    token = _extract_token(credentials)
    return await _load_user_from_token(token, db)


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Like :func:`get_current_user` but additionally requires ``is_active``."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact support.",
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser privileges required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# WebSocket token extraction (token passed as query param)
# ---------------------------------------------------------------------------

async def get_ws_user(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate a WebSocket connection via ``?token=<jwt>`` query param."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    return await _load_user_from_token(token, db)
