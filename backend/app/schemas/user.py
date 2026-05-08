from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    display_name: Optional[str] = Field(default=None, max_length=128)
    avatar_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Create (registration)
# ---------------------------------------------------------------------------

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Read (API response)
# ---------------------------------------------------------------------------

class UserRead(UserBase):
    """Safe user representation returned in API responses."""

    id: UUID
    is_active: bool
    is_verified: bool
    preferences: Optional[Dict[str, Any]] = None
    oauth_provider: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Update (PATCH /users/me)
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=128)
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=64)


# ---------------------------------------------------------------------------
# Profile (richer view, e.g. public profile page)
# ---------------------------------------------------------------------------

class UserProfile(UserRead):
    """Extended user profile with stats and public-facing data."""

    total_conversations: int = 0
    total_messages: int = 0
