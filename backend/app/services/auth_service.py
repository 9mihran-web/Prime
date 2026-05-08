from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Return the :class:`User` row matching *email*, or ``None``."""
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """Return the :class:`User` row matching *username*, or ``None``."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> Optional[User]:
    """Return the authenticated :class:`User` or ``None`` on failure.

    Checks that the user exists, has a hashed password set (i.e. is not
    OAuth-only), and that the supplied password is correct.
    """
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not user.hashed_password:
        # OAuth-only account — cannot log in with a password
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    """Persist a new :class:`User` and return the ORM instance.

    Raises:
        ValueError: if the email or username is already taken.
    """
    # Guard against duplicates
    if await get_user_by_email(db, user_in.email):
        raise ValueError(f"Email '{user_in.email}' is already registered.")
    if await get_user_by_username(db, user_in.username):
        raise ValueError(f"Username '{user_in.username}' is already taken.")

    user = User(
        email=user_in.email.lower(),
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        display_name=user_in.display_name or user_in.username,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()  # assign PK without committing the outer transaction
    await db.refresh(user)
    return user
