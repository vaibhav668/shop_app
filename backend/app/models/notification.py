import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKey


class Notification(UUIDPrimaryKey, Base):
    """What the customer sees in the app's notification list. The push is sent from this row,
    after the transaction that created it commits."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_time", "user_id", text("created_at DESC")),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)  # e.g. ORDER_STATUS
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # {"order_id": "...", "route": "/orders/..."}: where tapping the notification leads.
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # clock_timestamp(): several notifications made in one transaction still list in order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
