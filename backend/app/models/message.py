from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(BaseModel):
    """A single message within a :class:`Conversation`."""

    __tablename__ = "messages"

    # ------------------------------------------------------------------
    # Ownership
    # ------------------------------------------------------------------
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Content
    # ------------------------------------------------------------------
    role: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        # "user" | "assistant" | "system" | "tool"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # ------------------------------------------------------------------
    # Token accounting
    # ------------------------------------------------------------------
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ------------------------------------------------------------------
    # Extensible metadata (tool calls, attachments, citations, …)
    # ------------------------------------------------------------------
    message_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Stores tool calls, attachments, function results, etc.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        preview = (self.content or "")[:40].replace("\n", " ")
        return f"<Message id={self.id} role={self.role!r} content={preview!r}>"
