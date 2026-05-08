from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.user import User


class Conversation(BaseModel):
    """A chat session belonging to a user."""

    __tablename__ = "conversations"

    # ------------------------------------------------------------------
    # Ownership
    # ------------------------------------------------------------------
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------
    title: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default="New Conversation",
    )
    model_used: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
    )
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    user: Mapped["User"] = relationship(
        "User",
        back_populates="conversations",
        lazy="select",
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Conversation id={self.id} title={self.title!r}>"
