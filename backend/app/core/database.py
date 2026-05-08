from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ---------------------------------------------------------------------------
# Declarative base — shared by all ORM models
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all PRIME models."""
    pass


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def _build_engine() -> AsyncEngine:
    connect_args: dict = {}
    if "asyncpg" in settings.DATABASE_URL:
        # asyncpg-specific tuning
        connect_args = {
            "statement_cache_size": 0,  # required for PgBouncer compatibility
            "prepared_statement_cache_size": 0,
        }

    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )


engine: AsyncEngine = _build_engine()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an :class:`AsyncSession` and guarantee it is closed afterwards.

    Usage::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Table creation helper (used during tests / startup when Alembic is skipped)
# ---------------------------------------------------------------------------

async def create_all_tables() -> None:
    """Create all tables defined in the ORM models.

    Only intended for testing or minimal deployments — prefer Alembic in
    production.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """Drop all tables — **destructive**, test-only."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
