import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt, Timestamps, UUIDPrimaryKey


class Category(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    # Storage key; URLs (and thumbnail sizes) are derived at response time.
    image_key: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price_paise > 0", name="price_positive"),
        CheckConstraint("mrp_paise >= price_paise", name="mrp_not_below_price"),
        CheckConstraint("stock_quantity >= 0", name="stock_not_negative"),
        CheckConstraint(
            "max_per_order IS NULL OR max_per_order > 0", name="max_per_order_positive"
        ),
        CheckConstraint(
            "low_stock_threshold IS NULL OR low_stock_threshold >= 0",
            name="low_stock_threshold_not_negative",
        ),
        Index("ix_products_category_listing", "category_id", "is_active", "sort_order"),
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    unit_label: Mapped[str] = mapped_column(Text, nullable=False)
    price_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mrp_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Units available to sell. Only InventoryService writes this column.
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_stock_threshold: Mapped[int | None] = mapped_column(Integer)
    max_per_order: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_key: Mapped[str | None] = mapped_column(Text)
    search_keywords: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    category: Mapped[Category] = relationship(back_populates="products")


class InventoryReason(str, enum.Enum):
    INITIAL = "INITIAL"
    ORDER_PLACED = "ORDER_PLACED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    MANUAL_ADJUST = "MANUAL_ADJUST"
    STOCK_SET = "STOCK_SET"


class InventoryMovement(UUIDPrimaryKey, CreatedAt, Base):
    """Append-only log: every change to products.stock_quantity writes one row."""

    __tablename__ = "inventory_movements"
    __table_args__ = (Index("ix_inventory_movements_product_time", "product_id", "created_at"),)

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    resulting_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[InventoryReason] = mapped_column(
        Enum(InventoryReason, name="inventory_reason"), nullable=False
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("orders.id", ondelete="RESTRICT"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(Text)


class ShopSettings(Base):
    """Exactly one row (id = 1): the shop's delivery rules and switches."""

    __tablename__ = "shop_settings"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    shop_name: Mapped[str] = mapped_column(Text, nullable=False, default="Bada Bazar")
    shop_phone: Mapped[str | None] = mapped_column(Text)
    shop_address: Mapped[str | None] = mapped_column(Text)
    is_accepting_orders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    closed_message: Mapped[str] = mapped_column(
        Text, nullable=False, default="We're closed right now. Back tomorrow at 8 AM."
    )
    delivery_fee_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=2000)
    free_delivery_above_paise: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=29900
    )
    min_order_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=9900)
    serviceable_pincodes: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list
    )
    cod_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    online_payment_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    payment_timeout_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    default_low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
