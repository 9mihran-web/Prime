from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_active_user, get_db
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationRead,
    ConversationSummary,
    MessageRead,
    StreamChunk,
)
from app.services.ai.model_router import model_router

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

async def _get_conversation_or_404(
    conversation_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
            Conversation.is_archived.is_(False),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return conv


async def _load_message_history(
    conversation_id: UUID,
    db: AsyncSession,
) -> List[dict]:
    """Return all messages as OpenAI-compatible dicts, ordered by creation time."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [{"role": msg.role, "content": msg.content} for msg in messages]


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

@router.get(
    "/conversations",
    response_model=List[ConversationSummary],
    summary="List all conversations for the current user",
)
async def list_conversations(
    archived: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[ConversationSummary]:
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.is_archived.is_(archived),
        )
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    conversations = result.scalars().all()
    return [ConversationSummary.model_validate(c) for c in conversations]


@router.post(
    "/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationRead:
    conv = Conversation(
        user_id=current_user.id,
        title=payload.title or "New Conversation",
        model_used=payload.model or settings.DEFAULT_MODEL,
    )
    db.add(conv)
    await db.flush()
    await db.refresh(conv)
    return ConversationRead.model_validate(conv)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationRead,
    summary="Retrieve a conversation with all its messages",
)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationRead:
    conv = await _get_conversation_or_404(conversation_id, current_user.id, db)

    # Eager-load messages
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    conv_dict = {
        "id": conv.id,
        "user_id": conv.user_id,
        "title": conv.title,
        "model_used": conv.model_used,
        "total_tokens": conv.total_tokens,
        "is_archived": conv.is_archived,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "messages": [MessageRead.model_validate(m) for m in messages],
    }
    return ConversationRead.model_validate(conv_dict)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a conversation",
)
async def archive_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    conv = await _get_conversation_or_404(conversation_id, current_user.id, db)
    conv.is_archived = True
    await db.flush()


# ---------------------------------------------------------------------------
# Messages / Chat
# ---------------------------------------------------------------------------

@router.post(
    "/conversations/{conversation_id}/messages",
    summary="Send a message and receive a response (supports SSE streaming)",
)
async def send_message(
    conversation_id: UUID,
    payload: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a user message and receive the AI response.

    When ``payload.stream`` is ``True`` the response is a
    ``text/event-stream`` (SSE) where each event carries a
    :class:`~app.schemas.chat.StreamChunk` JSON payload.

    When ``payload.stream`` is ``False`` the response is a standard
    :class:`~app.schemas.chat.ChatResponse` JSON object.
    """
    conv = await _get_conversation_or_404(conversation_id, current_user.id, db)
    model = payload.model or conv.model_used or settings.DEFAULT_MODEL

    # Persist the user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
    )
    db.add(user_msg)
    await db.flush()
    await db.refresh(user_msg)

    # Build the full message history for the API call
    history = await _load_message_history(conv.id, db)

    # Optionally prepend a system prompt
    openai_messages = []
    if payload.system_prompt:
        openai_messages.append({"role": "system", "content": payload.system_prompt})
    openai_messages.extend(history)

    if payload.stream:
        return EventSourceResponse(
            _stream_response(
                conv=conv,
                user_msg=user_msg,
                openai_messages=openai_messages,
                model=model,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
                db=db,
            ),
            media_type="text/event-stream",
        )

    # --- Non-streaming path ---
    try:
        full_response = await model_router.chat(
            messages=openai_messages,
            model=model,
            stream=False,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens or 2048,
        )
    except Exception as exc:
        logger.exception("AI chat_completion failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {exc}",
        ) from exc

    # Rough token count using character heuristic (replace with tiktoken if needed)
    tokens_used = len(full_response) // 4

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=full_response,
        tokens_used=tokens_used,
    )
    db.add(assistant_msg)
    conv.total_tokens = (conv.total_tokens or 0) + tokens_used
    await db.flush()
    await db.refresh(assistant_msg)

    return ChatResponse(
        message=MessageRead.model_validate(assistant_msg),
        conversation_id=conv.id,
        tokens_used=tokens_used,
    )


async def _stream_response(
    conv: Conversation,
    user_msg: Message,
    openai_messages: List[dict],
    model: str,
    temperature: float,
    max_tokens: Optional[int],
    db: AsyncSession,
) -> AsyncGenerator[dict, None]:
    """Async generator yielding SSE-compatible dicts for EventSourceResponse."""
    full_content = ""
    try:
        generator = await model_router.chat(
            messages=openai_messages,
            model=model,
            stream=True,
            temperature=temperature,
            max_tokens=max_tokens or 2048,
        )
        async for delta in generator:
            full_content += delta
            chunk = StreamChunk(event="delta", delta=delta)
            yield {"data": chunk.model_dump_json()}

    except Exception as exc:
        logger.exception("AI streaming chat_completion failed")
        error_chunk = StreamChunk(event="error", error=str(exc))
        yield {"data": error_chunk.model_dump_json()}
        return

    # Persist assistant message
    tokens_used = len(full_content) // 4
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=full_content,
        tokens_used=tokens_used,
    )
    db.add(assistant_msg)
    conv.total_tokens = (conv.total_tokens or 0) + tokens_used
    await db.flush()
    await db.refresh(assistant_msg)

    done_chunk = StreamChunk(
        event="done",
        message=MessageRead.model_validate(assistant_msg),
        tokens=tokens_used,
    )
    yield {"data": done_chunk.model_dump_json()}
