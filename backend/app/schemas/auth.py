from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Inbound
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """Credentials submitted to ``POST /auth/login``."""

    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    """Payload for ``POST /auth/register``."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        has_upper = any(c.isupper() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not has_upper or not has_digit:
            raise ValueError(
                "Password must contain at least one uppercase letter and one digit."
            )
        return v


class RefreshRequest(BaseModel):
    """Payload for ``POST /auth/refresh``."""

    refresh_token: str


# ---------------------------------------------------------------------------
# Outbound
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    """JWT token pair returned after successful auth."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token TTL in seconds")


class TokenData(BaseModel):
    """Decoded claims stored in a JWT payload."""

    user_id: UUID
    email: EmailStr
    token_type: str = "access"


class LogoutResponse(BaseModel):
    message: str = "Successfully logged out."
