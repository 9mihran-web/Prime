from __future__ import annotations

import logging
from typing import AsyncGenerator, List, Optional
from urllib.parse import urlparse

import httpx
from openai import AsyncOpenAI, APIConnectionError, APIStatusError, APITimeoutError

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    """Async AI service that targets a locally-running Ollama instance.

    Chat completions use the OpenAI-compatible endpoint that Ollama exposes
    at ``<base_url>/v1``, so the standard ``openai`` Python SDK can be used
    without any changes.  Embeddings and model discovery use Ollama's native
    REST API (``/api/embeddings`` and ``/api/tags``) because those endpoints
    are not fully OpenAI-compatible.

    A single shared instance is created at module level so the underlying
    ``httpx.AsyncClient`` connection pool is reused across the application
    lifetime.
    """

    def __init__(self) -> None:
        # Normalise the base URL: strip a trailing slash so we can build
        # sub-paths predictably.
        base = settings.OLLAMA_BASE_URL.rstrip("/")

        # Parse out just the host portion (scheme + netloc) for native API
        # calls.  e.g. "http://localhost:11434/v1" → "http://localhost:11434"
        parsed = urlparse(base)
        self._host = f"{parsed.scheme}://{parsed.netloc}" if parsed.netloc else base

        # openai SDK client pointed at Ollama's /v1 chat endpoint.
        # Ollama does not require an API key — we pass a dummy value so the
        # SDK does not raise a missing-key error.
        openai_base = f"{self._host}/v1"
        self._client = AsyncOpenAI(
            api_key="ollama",  # not validated by Ollama, but required by SDK
            base_url=openai_base,
            max_retries=0,
            timeout=httpx.Timeout(120.0, connect=10.0),
        )

        # Separate httpx client for Ollama-native endpoints.
        self._http = httpx.AsyncClient(
            base_url=self._host,
            timeout=httpx.Timeout(120.0, connect=10.0),
        )

        self._model = settings.OLLAMA_MODEL
        self._embed_model = settings.OLLAMA_EMBED_MODEL

    # ------------------------------------------------------------------
    # Chat completion
    # ------------------------------------------------------------------

    async def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str | AsyncGenerator[str, None]:
        """Send a chat completion request to Ollama via the OpenAI-compatible API.

        Args:
            messages: List of ``{"role": ..., "content": ...}`` dicts.
            model: Override the configured Ollama model.
            stream: ``True`` → returns an async generator yielding text
                deltas; ``False`` → returns the full response string.
            temperature: Sampling temperature (0–2).
            max_tokens: Maximum number of tokens to generate.

        Returns:
            ``str`` when *stream* is ``False``,
            ``AsyncGenerator[str, None]`` when *stream* is ``True``.
        """
        resolved_model = model or self._model

        if stream:
            return self._stream_completion(
                messages=messages,
                model=resolved_model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        return await self._full_completion(
            messages=messages,
            model=resolved_model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def _full_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Execute a non-streaming chat completion."""
        try:
            response = await self._client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False,
            )
            return response.choices[0].message.content or ""
        except APIConnectionError as exc:
            logger.error(
                "Cannot reach Ollama at %s — is it running? (%s)",
                self._host,
                exc,
            )
            raise RuntimeError(
                f"Ollama is not reachable at {self._host}. "
                "Start Ollama with `ollama serve` and ensure the model is pulled."
            ) from exc
        except APITimeoutError as exc:
            logger.error("Ollama request timed out: %s", exc)
            raise RuntimeError("Ollama request timed out.") from exc
        except APIStatusError as exc:
            logger.error("Ollama API error %d: %s", exc.status_code, exc.message)
            raise

    async def _stream_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> AsyncGenerator[str, None]:
        """Return an async generator that yields text deltas from Ollama."""
        try:
            async with await self._client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            ) as stream:
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta is not None:
                        yield delta
        except APIConnectionError as exc:
            logger.error("Ollama stream connection error: %s", exc)
            raise RuntimeError(
                f"Ollama is not reachable at {self._host}. "
                "Start Ollama with `ollama serve` and ensure the model is pulled."
            ) from exc
        except APITimeoutError as exc:
            logger.error("Ollama stream timed out: %s", exc)
            raise RuntimeError("Ollama streaming request timed out.") from exc
        except APIStatusError as exc:
            logger.error("Ollama stream API error %d: %s", exc.status_code, exc.message)
            raise

    # ------------------------------------------------------------------
    # Embeddings (Ollama native API — not OpenAI-compatible)
    # ------------------------------------------------------------------

    async def embed_text(self, text: str) -> List[float]:
        """Return a dense embedding vector using Ollama's native embeddings API.

        Uses the model specified by ``OLLAMA_EMBED_MODEL`` (default:
        ``nomic-embed-text``).

        Args:
            text: The text to embed.

        Returns:
            List of floats representing the embedding vector.

        Raises:
            RuntimeError: If Ollama is unreachable or returns an error.
        """
        try:
            response = await self._http.post(
                "/api/embeddings",
                json={"model": self._embed_model, "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            embedding = data.get("embedding")
            if not embedding:
                raise RuntimeError(
                    f"Ollama returned an empty embedding for model '{self._embed_model}'."
                )
            return embedding
        except httpx.ConnectError as exc:
            logger.error("Cannot reach Ollama for embeddings at %s: %s", self._host, exc)
            raise RuntimeError(
                f"Ollama is not reachable at {self._host}. "
                "Start Ollama with `ollama serve`."
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error("Ollama embeddings request timed out: %s", exc)
            raise RuntimeError("Ollama embeddings request timed out.") from exc
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Ollama embeddings API error %d: %s",
                exc.response.status_code,
                exc.response.text,
            )
            raise RuntimeError(
                f"Ollama embeddings error {exc.response.status_code}: {exc.response.text}"
            ) from exc

    # ------------------------------------------------------------------
    # Model discovery
    # ------------------------------------------------------------------

    async def list_models(self) -> List[str]:
        """Return the names of all locally available Ollama models.

        Calls ``GET /api/tags`` and extracts the ``name`` field from each
        model entry.

        Returns:
            List of model name strings (e.g. ``["prime:latest", "llama3.1:8b"]``).
            Returns an empty list if Ollama is unreachable rather than raising.
        """
        try:
            response = await self._http.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            return [m["name"] for m in data.get("models", [])]
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.warning("Ollama not reachable — returning empty model list.")
            return []
        except httpx.HTTPStatusError as exc:
            logger.warning("Ollama /api/tags returned %d", exc.response.status_code)
            return []

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Return ``True`` if Ollama is running and reachable.

        Sends a lightweight ``GET /`` request (Ollama responds with
        ``"Ollama is running"``).
        """
        try:
            response = await self._http.get("/", timeout=5.0)
            return response.status_code < 500
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP clients."""
        await self._client.close()
        await self._http.aclose()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

ollama_service = OllamaService()
