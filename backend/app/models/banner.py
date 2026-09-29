import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class BannerTarget(str, enum.Enum):
    NONE = "NONE"
    CATEGORY = "CATEGORY"
    PRODUCT = "PRODUCT"


class Banner(UUIDPrimaryKey, Timestamps, Base):
    """A home-screen promotion. Text is rendered by the app, not baked into the photo."""

    __tablename__ = "banners"
    __table_args__ = (
        CheckConstraint(
            "(target_type = 'NONE') = (target_id IS NULL)", name="target_id_matches_type"
        ),
        CheckConstraint(
            "ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at", name="ends_after_start"
        ),
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text)
    image_key: Mapped[str | None] = mapped_column(Text)
    # Not a foreign key: the target may be a category or a product. Resolved (and skipped
    # if hidden or gone) when the home screen is built.
    target_type: Mapped[BannerTarget] = mapped_column(
        Enum(BannerTarget, name="banner_target"), nullable=False, default=BannerTarget.NONE
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column()
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
