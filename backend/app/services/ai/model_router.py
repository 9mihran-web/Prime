from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.ai.ollama_service import ollama_service
from app.services.ai.openai_service import openai_service

logger = logging.getLogger(__name__)


class ModelRouter:
    """Routes AI requests to the appropriate backend (Ollama or OpenAI).

    The active backend is selected in this priority order:

    1. If a *model* name is explicitly supplied and it is recognised as a
       local model → Ollama.
    2. If a *model* name is explicitly supplied and it is recognised as an
       OpenAI model → OpenAI.
    3. If no model is supplied, ``settings.DEFAULT_MODEL`` is used.  Its
       backend is resolved the same way.
    4. When ``settings.AI_PROVIDER == "auto"`` and the chosen backend is
       Ollama but Ollama appears to be down, the router falls back to OpenAI
       (if an API key is configured) instead of raising immediately.

    ``AI_PROVIDER`` can be set to:
    * ``"ollama"``   – always use Ollama, error if unavailable.
    * ``"openai"``   – always use OpenAI.
    * ``"auto"``     – prefer Ollama, fall back to OpenAI when Ollama is down.
    """

    # Known local model name prefixes / exact names.
    LOCAL_MODELS: frozenset[str] = frozenset(
        {
            "prime",
            "llama3.1",
            "llama3.1:8b",
            "llama3.1:70b",
            "llama3.2",
            "llama3.2:3b",
            "llama3.2:1b",
            "llama3",
            "mistral",
            "mistral:7b",
            "gemma2",
            "gemma2:9b",
            "gemma2:27b",
            "phi3",
            "phi3:mini",
            "phi3:medium",
            "qwen2.5",
            "qwen2.5:7b",
            "qwen2.5:14b",
            "qwen2.5:72b",
            "codellama",
            "deepseek-coder",
            "nomic-embed-text",
        }
    )

    OPENAI_MODELS: frozenset[str] = frozenset(
        {
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4-turbo-preview",
            "gpt-4",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-16k",
        }
    )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_backend(self, model: str) -> str:
        """Return ``"ollama"`` or ``"openai"`` for *model*.

        When ``AI_PROVIDER`` is ``"ollama"`` or ``"openai"`` it is treated as
        an override regardless of the model name.  In ``"auto"`` mode the
        model name determines the backend, with Ollama as the default for
        unknown models.
        """
        provider = settings.AI_PROVIDER.lower()

        if provider == "openai":
            return "openai"
        if provider == "ollama":
            return "ollama"

        # "auto" — pick by model name
        base_name = model.split(":")[0].lower()
        if model.lower() in self.OPENAI_MODELS or base_name in self.OPENAI_MODELS:
            return "openai"
        # Default to Ollama for all local / unknown model names
        return "ollama"

    def _openai_available(self) -> bool:
        """Return ``True`` when an OpenAI API key is configured."""
        key = settings.OPENAI_API_KEY
        return bool(key and key not in {"", "sk-placeholder"})

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any,
    ) -> str | AsyncGenerator[str, None]:
        """Route a chat completion to the appropriate backend.

        Args:
            messages: List of ``{"role": ..., "content": ...}`` dicts.
            model: Model name to use.  Defaults to ``settings.DEFAULT_MODEL``.
            stream: If ``True``, return an async generator of text deltas.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            **kwargs: Additional keyword arguments forwarded to the backend.

        Returns:
            ``str`` when *stream* is ``False``;
            ``AsyncGenerator[str, None]`` when *stream* is ``True``.

        Raises:
            RuntimeError: If the chosen backend is unavailable and no fallback
                is possible.
        """
        resolved_model = model or settings.DEFAULT_MODEL
        backend = self._resolve_backend(resolved_model)

        if backend == "ollama":
            # If the resolved model is an OpenAI model name (e.g. stored in DB
            # from an old conversation), override it with the configured Ollama model.
            ollama_model = (
                resolved_model
                if resolved_model not in self.OPENAI_MODELS
                else settings.OLLAMA_MODEL
            )

            # In "auto" mode, check liveness first so we can fall back quickly.
            if settings.AI_PROVIDER.lower() == "auto":
                ollama_alive = await ollama_service.health_check()
                if not ollama_alive:
                    if self._openai_available():
                        logger.warning(
                            "Ollama is unreachable — falling back to OpenAI for model '%s'.",
                            ollama_model,
                        )
                        return await openai_service.chat_completion(
                            messages=messages,
                            model=settings.OPENAI_MODEL,
                            stream=stream,
                            temperature=temperature,
                            max_tokens=max_tokens,
                        )
                    raise RuntimeError(
                        "Ollama is not running and no OpenAI API key is configured. "
                        "Start Ollama with `ollama serve` or set OPENAI_API_KEY."
                    )

            return await ollama_service.chat_completion(
                messages=messages,
                model=ollama_model,
                stream=stream,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        # OpenAI backend
        if not self._openai_available():
            raise RuntimeError(
                "Model '%s' requires OpenAI but OPENAI_API_KEY is not configured."
                % resolved_model
            )
        return await openai_service.chat_completion(
            messages=messages,
            model=resolved_model,
            stream=stream,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    async def embed(self, text: str) -> List[float]:
        """Embed *text*, preferring Ollama and falling back to OpenAI.

        Ollama is always tried first regardless of ``AI_PROVIDER``.  If it
        is unreachable and OpenAI is configured, OpenAI embeddings are used
        as a fallback.

        Args:
            text: The text to embed.

        Returns:
            List of floats representing the embedding vector.

        Raises:
            RuntimeError: If no embedding backend is available.
        """
        # Try Ollama first
        try:
            ollama_alive = await ollama_service.health_check()
            if ollama_alive:
                return await ollama_service.embed_text(text)
        except Exception as exc:
            logger.warning("Ollama embed failed (%s), trying OpenAI fallback.", exc)

        # Fall back to OpenAI if key is present
        if self._openai_available():
            logger.info("Using OpenAI embeddings as fallback.")
            return await openai_service.embed_text(text)

        raise RuntimeError(
            "No embedding backend is available. "
            "Start Ollama or configure OPENAI_API_KEY."
        )

    # ------------------------------------------------------------------
    # Model discovery
    # ------------------------------------------------------------------

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Return a combined list of models from all configured backends.

        Each entry has the shape::

            {
                "id":        str,   # model identifier
                "backend":   str,   # "ollama" | "openai"
                "available": bool,  # whether the backend is reachable
            }

        OpenAI models are included only when an API key is configured.
        """
        models: List[Dict[str, Any]] = []

        # ---- Ollama ----
        ollama_alive = await ollama_service.health_check()
        if ollama_alive:
            for name in await ollama_service.list_models():
                models.append({"id": name, "backend": "ollama", "available": True})
        else:
            # Surface the configured default local model as unavailable so
            # callers know it exists but Ollama is down.
            models.append(
                {
                    "id": settings.OLLAMA_MODEL,
                    "backend": "ollama",
                    "available": False,
                }
            )

        # ---- OpenAI ----
        if self._openai_available():
            for name in self.OPENAI_MODELS:
                models.append({"id": name, "backend": "openai", "available": True})

        return models


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

model_router = ModelRouter()
