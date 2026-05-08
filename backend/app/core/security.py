from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return ``True`` if *plain_password* matches *hashed_password*."""
    return _pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

class TokenData:
    """Payload extracted from a verified JWT."""

    def __init__(
        self,
        user_id: Union[str, UUID],
        email: str,
        token_type: str = "access",
    ) -> None:
        self.user_id = str(user_id)
        self.email = email
        self.token_type = token_type

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TokenData user_id={self.user_id} type={self.token_type}>"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token.

    Args:
        data: Arbitrary claims to embed (``sub``, ``email`` are expected).
        expires_delta: Override the default expiry window.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = _utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update(
        {
            "exp": expire,
            "iat": _utcnow(),
            "type": "access",
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT refresh token with a longer TTL.

    Args:
        data: Arbitrary claims (same shape as access token).
        expires_delta: Override the default refresh expiry window.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = _utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update(
        {
            "exp": expire,
            "iat": _utcnow(),
            "type": "refresh",
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, expected_type: str = "access") -> TokenData:
    """Decode and validate a JWT.

    Args:
        token: Raw JWT string.
        expected_type: ``"access"`` or ``"refresh"`` — enforced from the
            ``type`` claim to prevent token confusion attacks.

    Returns:
        :class:`TokenData` populated from the token payload.

    Raises:
        :class:`jose.JWTError`: If the token is invalid, expired, or of the
            wrong type.
    """
    payload: Dict[str, Any] = jwt.decode(
        token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )

    token_type: str = payload.get("type", "access")
    if token_type != expected_type:
        raise JWTError(
            f"Invalid token type: expected '{expected_type}', got '{token_type}'"
        )

    user_id: Optional[str] = payload.get("sub")
    email: Optional[str] = payload.get("email")

    if user_id is None or email is None:
        raise JWTError("Token is missing required claims (sub, email)")

    return TokenData(user_id=user_id, email=email, token_type=token_type)
