from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, List, Optional, Union

from pydantic import AnyHttpUrl, Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Application
    # ------------------------------------------------------------------ #
    APP_NAME: str = "PRIME API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # ------------------------------------------------------------------ #
    # Database
    # ------------------------------------------------------------------ #
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://prime:prime@localhost:5432/prime_db",
    )

    # ------------------------------------------------------------------ #
    # Redis
    # ------------------------------------------------------------------ #
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # ------------------------------------------------------------------ #
    # Security / JWT
    # ------------------------------------------------------------------ #
    SECRET_KEY: str = Field(default="changeme-super-secret-key-at-least-32-chars!!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ------------------------------------------------------------------ #
    # AI provider selection
    # ------------------------------------------------------------------ #
    # "ollama"  — always use Ollama (local)
    # "openai"  — always use OpenAI (cloud)
    # "auto"    — prefer Ollama, fall back to OpenAI when Ollama is down
    AI_PROVIDER: str = "ollama"
    DEFAULT_MODEL: str = "llama3.2:3b"

    # ------------------------------------------------------------------ #
    # Ollama (local models — no API key required)
    # ------------------------------------------------------------------ #
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # ------------------------------------------------------------------ #
    # OpenAI (optional cloud fallback)
    # ------------------------------------------------------------------ #
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_TTS_MODEL: str = "tts-1"
    OPENAI_WHISPER_MODEL: str = "whisper-1"

    # ------------------------------------------------------------------ #
    # CORS
    # ------------------------------------------------------------------ #
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> List[str]:
        if isinstance(value, str):
            # Accept JSON array string or comma-separated
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    # ------------------------------------------------------------------ #
    # Pinecone (vector memory — optional)
    # ------------------------------------------------------------------ #
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENV: Optional[str] = None
    PINECONE_INDEX: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Rate limiting
    # ------------------------------------------------------------------ #
    RATE_LIMIT_PER_MINUTE: int = 60

    # ------------------------------------------------------------------ #
    # Celery
    # ------------------------------------------------------------------ #
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/2")

    # ------------------------------------------------------------------ #
    # WebSocket
    # ------------------------------------------------------------------ #
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
