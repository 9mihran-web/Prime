from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.ai.model_router import model_router

logger = logging.getLogger(__name__)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Return the cosine similarity between two equal-length vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class MemoryEntry:
    """In-process representation of a stored memory."""

    def __init__(
        self,
        memory_id: str,
        user_id: str,
        content: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id = memory_id
        self.user_id = user_id
        self.content = content
        self.embedding = embedding
        self.metadata = metadata or {}
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "content": self.content,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }


class MemoryService:
    """Vector-based memory store for PRIME.

    Memories are embedded via :class:`ModelRouter` (Ollama by default, with an
    automatic fallback to OpenAI when Ollama is unavailable) and stored in an
    in-process dict keyed by ``user_id``.  For production replace the
    ``_store`` dict with a pgvector table or Pinecone index — the public API
    contract stays the same.
    """

    def __init__(self) -> None:
        # { user_id: [MemoryEntry, ...] }
        self._store: Dict[str, List[MemoryEntry]] = {}

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    async def save_memory(
        self,
        user_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Embed *content* and persist as a memory for *user_id*.

        Args:
            user_id: Owning user's UUID string.
            content: Free-text memory content.
            metadata: Arbitrary key-value tags (source, importance, …).

        Returns:
            Serialised :class:`MemoryEntry` dict (without the embedding).
        """
        try:
            embedding = await model_router.embed(content)
        except Exception as exc:
            logger.warning("Embedding failed, storing memory without vector: %s", exc)
            embedding = []

        entry = MemoryEntry(
            memory_id=str(uuid.uuid4()),
            user_id=user_id,
            content=content,
            embedding=embedding,
            metadata=metadata,
        )
        self._store.setdefault(user_id, []).append(entry)
        logger.debug("Saved memory %s for user %s", entry.id, user_id)
        return entry.to_dict()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get_all_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Return all memories for *user_id* ordered by recency."""
        entries = self._store.get(user_id, [])
        return [e.to_dict() for e in reversed(entries)]

    async def search_memories(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Semantic search over a user's memories.

        Embeds *query* and ranks stored memories by cosine similarity.

        Args:
            user_id: Owner whose memories are searched.
            query: Natural-language search query.
            top_k: Maximum number of results to return.

        Returns:
            List of serialised memory dicts, highest similarity first,
            each augmented with a ``score`` field (0–1).
        """
        entries = self._store.get(user_id, [])
        if not entries:
            return []

        try:
            query_vec = await model_router.embed(query)
        except Exception as exc:
            logger.warning("Query embedding failed, falling back to keyword search: %s", exc)
            # Simple substring fallback
            q_lower = query.lower()
            matches = [e for e in entries if q_lower in e.content.lower()]
            result = [e.to_dict() for e in matches[:top_k]]
            for item in result:
                item["score"] = 1.0
            return result

        scored: List[tuple[float, MemoryEntry]] = []
        for entry in entries:
            if entry.embedding:
                score = _cosine_similarity(query_vec, entry.embedding)
                scored.append((score, entry))

        scored.sort(key=lambda t: t[0], reverse=True)
        results = []
        for score, entry in scored[:top_k]:
            d = entry.to_dict()
            d["score"] = round(score, 4)
            results.append(d)
        return results

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_memory(self, memory_id: str) -> bool:
        """Remove memory with *memory_id* from the store.

        Returns:
            ``True`` if found and deleted, ``False`` if not found.
        """
        for user_id, entries in self._store.items():
            for i, entry in enumerate(entries):
                if entry.id == memory_id:
                    self._store[user_id].pop(i)
                    logger.debug("Deleted memory %s", memory_id)
                    return True
        return False


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

memory_service = MemoryService()
