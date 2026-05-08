from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ---------------------------------------------------------------------------
# Make the app importable from alembic/
# ---------------------------------------------------------------------------
# Resolve the backend root (one level above this file's directory)
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ---------------------------------------------------------------------------
# Import application settings and models so Alembic can see the metadata
# ---------------------------------------------------------------------------
from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402

# Import every model module so SQLAlchemy registers their tables in Base.metadata
import app.models.user  # noqa: F401, E402
import app.models.conversation  # noqa: F401, E402
import app.models.message  # noqa: F401, E402

# ---------------------------------------------------------------------------
# Alembic Config object — provides access to the .ini file values
# ---------------------------------------------------------------------------
config = context.config

# Override the sqlalchemy.url from our settings so we have a single source of truth.
# Strip "+asyncpg" for the sync Alembic connection used in offline mode.
_sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
config.set_main_option("sqlalchemy.url", _sync_url)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate support
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline migrations (no live DB connection needed)
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine, though
    an Engine is acceptable here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migrations (async engine)
# ---------------------------------------------------------------------------

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations inside a sync wrapper."""
    # Build an async engine from the alembic config
    # Restore the asyncpg driver for the actual connection
    async_url = settings.DATABASE_URL  # already has +asyncpg

    connectable = async_engine_from_config(
        {"sqlalchemy.url": async_url, **dict(config.get_section(config.config_ini_section) or {})},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using asyncio."""
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
