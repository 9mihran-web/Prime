from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------

class MessageCreate(BaseModel):
    role: Literal["user", "assistant", "system", "tool"] = "user"
    content: str = Field(min_length=1)
    message_metadata: Optional[Dict[str, Any]] = None


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    tokens_used: Optional[int] = None
    message_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default="New Conversation", max_length=512)
    model: Optional[str] = None  # override the global default model


class ConversationRead(BaseModel):
    id: UUID
    user_id: UUID
    title: Optional[str] = None
    model_used: Optional[str] = None
    total_tokens: int = 0
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime
    messages: List[MessageRead] = []

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ConversationSummary(BaseModel):
    """Lightweight conversation representation used in list endpoints."""

    id: UUID
    title: Optional[str] = None
    model_used: Optional[str] = None
    total_tokens: int = 0
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


# ---------------------------------------------------------------------------
# Chat request / response
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Payload sent to ``POST /conversations/{id}/messages``."""

    message: str = Field(min_length=1, max_length=32_768)
    conversation_id: Optional[UUID] = None
    model: Optional[str] = None  # client-side model override
    stream: bool = False
    system_prompt: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=128_000)


class ChatResponse(BaseModel):
    """Non-streaming response returned when ``stream=False``."""

    message: MessageRead
    conversation_id: UUID
    tokens_used: int = 0


# ---------------------------------------------------------------------------
# Server-sent events (SSE streaming)
# ---------------------------------------------------------------------------

class StreamChunk(BaseModel):
    """A single SSE data payload during a streaming chat response."""

    event: Literal["delta", "done", "error"] = "delta"
    # For "delta" events
    delta: Optional[str] = None
    # For "done" events — carries the full assistant message
    message: Optional[MessageRead] = None
    # For "error" events
    error: Optional[str] = None
    # Incremental token count
    tokens: Optional[int] = None
