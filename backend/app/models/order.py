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
    Identity,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt, Timestamps, UUIDPrimaryKey
from app.models.user import User

ORDER_NUMBER_START = 10001


class OrderStatus(str, enum.Enum):
    AWAITING_PAYMENT = "AWAITING_PAYMENT"  # online orders only, until the payment is verified
    PENDING = "PENDING"  # placed, waiting for the shop to accept
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


TERMINAL_STATUSES = frozenset({OrderStatus.DELIVERED, OrderStatus.CANCELLED})


class PaymentMethod(str, enum.Enum):
    ONLINE = "ONLINE"
    COD = "COD"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"


class PaymentAttemptStatus(str, enum.Enum):
    CREATED = "CREATED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"


_order_status = Enum(OrderStatus, name="order_status")


class Order(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_orders_user_idempotency_key"),
        CheckConstraint(
            "total_paise = subtotal_paise + delivery_fee_paise - discount_paise",
            name="total_adds_up",
        ),
        CheckConstraint("subtotal_paise > 0", name="subtotal_positive"),
        CheckConstraint(
            "delivery_fee_paise >= 0 AND discount_paise >= 0", name="fees_not_negative"
        ),
        Index("ix_orders_user_placed", "user_id", text("placed_at DESC")),
        Index("ix_orders_status_placed", "status", text("placed_at DESC")),
        Index(
            "ix_orders_awaiting_payment_expiry",
            "payment_expires_at",
            postgresql_where=text("status = 'AWAITING_PAYMENT'"),
        ),
    )

    # Shown to people as "#10042". Sequential, so it also tells the shop how busy it has been.
    order_number: Mapped[int] = mapped_column(
        BigInteger, Identity(always=True, start=ORDER_NUMBER_START), unique=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[OrderStatus] = mapped_column(_order_status, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method"), nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), nullable=False
    )
    subtotal_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    delivery_fee_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    discount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # A copy of the address at order time: editing or deleting the address never changes it.
    delivery_name: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_phone: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_line1: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_line2: Mapped[str | None] = mapped_column(Text)
    delivery_landmark: Mapped[str | None] = mapped_column(Text)
    delivery_city: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_state: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_pincode: Mapped[str] = mapped_column(Text, nullable=False)

    customer_note: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[uuid.UUID] = mapped_column(nullable=False)
    payment_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.position"
    )
    history: Mapped[list["OrderStatusHistory"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="(OrderStatusHistory.created_at, OrderStatusHistory.position)",
    )


class OrderItem(UUIDPrimaryKey, Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("line_total_paise = unit_price_paise * quantity", name="line_adds_up"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)  # the order the cart showed
    # Copied at order time, so later catalog edits never rewrite an old bill.
    product_name: Mapped[str] = mapped_column(Text, nullable=False)
    unit_label: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str | None] = mapped_column(Text)
    unit_price_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mrp_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)

    order: Mapped[Order] = relationship(back_populates="items")


class OrderStatusHistory(UUIDPrimaryKey, CreatedAt, Base):
    """One row per status change; drives the customer's timeline and the admin audit trail."""

    __tablename__ = "order_status_history"
    __table_args__ = (Index("ix_order_status_history_order_time", "order_id", "created_at"),)

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    # Tie-breaker for changes made in the same transaction (same created_at).
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    from_status: Mapped[OrderStatus | None] = mapped_column(_order_status)
    to_status: Mapped[OrderStatus] = mapped_column(_order_status, nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(  # null = the system
        ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(Text)

    order: Mapped[Order] = relationship(back_populates="history")
    actor: Mapped[User | None] = relationship()


class Payment(UUIDPrimaryKey, Timestamps, Base):
    """One row per online payment attempt. Created now; used from Phase 8."""

    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    provider_order_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(Text, unique=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    status: Mapped[PaymentAttemptStatus] = mapped_column(
        Enum(PaymentAttemptStatus, name="payment_attempt_status"), nullable=False
    )
    method: Mapped[str | None] = mapped_column(Text)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    refund_id: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
