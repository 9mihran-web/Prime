from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.services.ai.model_router import model_router
from app.services.ai.ollama_service import ollama_service
from app.services.ai.openai_service import openai_service
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ModelInfo(BaseModel):
    """Metadata for a single AI model."""

    id: str
    backend: str  # "ollama" | "openai"
    available: bool


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    default_model: str
    ai_provider: str


class BackendStatus(BaseModel):
    name: str
    available: bool
    base_url: str
    note: str = ""


class HealthResponse(BaseModel):
    backends: List[BackendStatus]
    overall: str  # "healthy" | "degraded" | "unavailable"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=ModelsResponse,
    summary="List all available AI models",
    description=(
        "Returns all models that are currently available across configured "
        "backends (Ollama and/or OpenAI).  Models hosted on a backend that "
        "is not reachable are included with ``available: false`` so the "
        "frontend can display an informative message."
    ),
)
async def list_models() -> ModelsResponse:
    """Return the combined model list from all configured AI backends."""
    try:
        raw = await model_router.get_available_models()
    except Exception as exc:
        logger.exception("Failed to retrieve model list")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not retrieve model list: {exc}",
        ) from exc

    return ModelsResponse(
        models=[ModelInfo(**m) for m in raw],
        default_model=settings.DEFAULT_MODEL,
        ai_provider=settings.AI_PROVIDER,
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check which AI backends are online",
    description=(
        "Performs a lightweight liveness check against each configured AI "
        "backend and reports whether it is reachable."
    ),
)
async def backend_health() -> HealthResponse:
    """Return the health status of all configured AI backends."""
    backends: List[BackendStatus] = []

    # ---- Ollama ----
    ollama_alive = await ollama_service.health_check()
    backends.append(
        BackendStatus(
            name="ollama",
            available=ollama_alive,
            base_url=settings.OLLAMA_BASE_URL,
            note=(
                "Running — default model: " + settings.OLLAMA_MODEL
                if ollama_alive
                else "Unreachable — run `ollama serve` to start it."
            ),
        )
    )

    # ---- OpenAI ----
    openai_key = settings.OPENAI_API_KEY
    openai_configured = bool(openai_key and openai_key not in {"", "sk-placeholder"})
    backends.append(
        BackendStatus(
            name="openai",
            available=openai_configured,
            base_url="https://api.openai.com/v1",
            note=(
                "API key configured — default model: " + settings.OPENAI_MODEL
                if openai_configured
                else "No API key set — set OPENAI_API_KEY to enable cloud fallback."
            ),
        )
    )

    available_count = sum(1 for b in backends if b.available)
    if available_count == len(backends):
        overall = "healthy"
    elif available_count > 0:
        overall = "degraded"
    else:
        overall = "unavailable"

    return HealthResponse(backends=backends, overall=overall)
