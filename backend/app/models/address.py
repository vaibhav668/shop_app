import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey

MAX_ADDRESSES_PER_USER = 20


class Address(UUIDPrimaryKey, Timestamps, Base):
    """A customer's saved delivery address. Orders copy it, so rows can be hard-deleted."""

    __tablename__ = "addresses"
    __table_args__ = (
        CheckConstraint(r"pincode ~ '^[1-9][0-9]{5}$'", name="pincode_format"),
        # At most one default per user, enforced by the database, not just the service.
        Index(
            "uq_addresses_one_default_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    line1: Mapped[str] = mapped_column(Text, nullable=False)
    line2: Mapped[str | None] = mapped_column(Text)
    landmark: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    pincode: Mapped[str] = mapped_column(Text, nullable=False)
    # Reserved for map pins later; unused in V1.
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    is_default: Mapped[bool] = mapped_column(nullable=False, default=False)
    # Set when an order is placed to this address (Phase 7); picks the next default on delete.
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
