import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt, Timestamps, UUIDPrimaryKey
from app.models.catalog import Product

MAX_LINE_QUANTITY = 50


class Cart(UUIDPrimaryKey, Timestamps, Base):
    """One per user. Stores products and quantities only — never prices."""

    __tablename__ = "carts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan", order_by="CartItem.created_at"
    )


class CartItem(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("cart_id", "product_id", name="uq_cart_items_cart_product"),
        CheckConstraint(f"quantity BETWEEN 1 AND {MAX_LINE_QUANTITY}", name="quantity_in_range"),
    )

    cart_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    cart: Mapped[Cart] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class Favourite(Base):
    __tablename__ = "favourites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
