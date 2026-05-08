from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.ai.memory_service import memory_service

router = APIRouter(prefix="/memory", tags=["memory"])


# ---------------------------------------------------------------------------
# Local schemas
# ---------------------------------------------------------------------------

class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Arbitrary tags such as source, topic, importance, etc.",
        examples=[{"source": "conversation", "topic": "Python"}],
    )


class MemoryRead(BaseModel):
    id: str
    user_id: str
    content: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: str
    score: Optional[float] = None  # populated for search results


class MemorySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_048)
    top_k: int = Field(default=5, ge=1, le=20)


class DeleteResponse(BaseModel):
    deleted: bool
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=List[MemoryRead],
    summary="Retrieve all stored memories for the current user",
)
async def get_memories(
    current_user: User = Depends(get_current_active_user),
) -> List[MemoryRead]:
    """Return all memories owned by the authenticated user, newest first."""
    memories = await memory_service.get_all_memories(str(current_user.id))
    return [MemoryRead(**m) for m in memories]


@router.post(
    "",
    response_model=MemoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new memory",
)
async def save_memory(
    payload: MemoryCreate,
    current_user: User = Depends(get_current_active_user),
) -> MemoryRead:
    """Embed *content* and persist it as a memory for the current user."""
    memory = await memory_service.save_memory(
        user_id=str(current_user.id),
        content=payload.content,
        metadata=payload.metadata,
    )
    return MemoryRead(**memory)


@router.delete(
    "/{memory_id}",
    response_model=DeleteResponse,
    summary="Delete a specific memory by ID",
)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_active_user),
) -> DeleteResponse:
    """Remove a memory from the store.

    Returns ``{"deleted": false}`` if the memory was not found rather than
    raising a 404, to keep delete operations idempotent.
    """
    deleted = await memory_service.delete_memory(memory_id)
    if deleted:
        return DeleteResponse(deleted=True, message=f"Memory '{memory_id}' deleted.")
    return DeleteResponse(deleted=False, message=f"Memory '{memory_id}' not found.")


@router.post(
    "/search",
    response_model=List[MemoryRead],
    summary="Semantic search over stored memories",
)
async def search_memories(
    payload: MemorySearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> List[MemoryRead]:
    """Find memories semantically similar to *query*.

    Results are returned ordered by relevance (highest cosine similarity first),
    each annotated with a ``score`` field between 0 and 1.
    """
    results = await memory_service.search_memories(
        user_id=str(current_user.id),
        query=payload.query,
        top_k=payload.top_k,
    )
    return [MemoryRead(**m) for m in results]
