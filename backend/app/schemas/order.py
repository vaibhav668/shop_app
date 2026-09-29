import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, field_validator

from app.models import OrderStatus, PaymentMethod, PaymentStatus
from app.schemas.checkout import CheckoutItem
from app.schemas.common import blank_to_none

Note = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None,
    BeforeValidator(blank_to_none),
]


# --- requests -----------------------------------------------------------------------------


class PlaceOrderRequest(BaseModel):
    address_id: uuid.UUID
    payment_method: PaymentMethod
    items: list[CheckoutItem] = Field(min_length=1, max_length=100)
    # Generated once per checkout by the app; resending it returns the same order.
    idempotency_key: uuid.UUID
    # The total the customer saw. If the server's total differs, nothing is placed.
    expected_total_paise: int = Field(ge=0)
    customer_note: Note = None

    @field_validator("items")
    @classmethod
    def _unique_products(cls, items: list[CheckoutItem]) -> list[CheckoutItem]:
        if len({item.product_id for item in items}) != len(items):
            raise ValueError("each product may appear only once")
        return items


class CancelOrderRequest(BaseModel):
    reason: Note = None


class StatusChangeRequest(BaseModel):
    to_status: OrderStatus
    note: Note = None


# --- responses ----------------------------------------------------------------------------


class OrderItemOut(BaseModel):
    product_id: uuid.UUID
    name: str
    unit_label: str
    image_url: str | None
    unit_price_paise: int
    mrp_paise: int
    quantity: int
    line_total_paise: int


class DeliveryAddressOut(BaseModel):
    name: str
    phone: str
    line1: str
    line2: str | None
    landmark: str | None
    city: str
    state: str
    pincode: str


class TimelineStep(BaseModel):
    status: OrderStatus
    at: datetime


class OrderSummaryOut(BaseModel):
    id: uuid.UUID
    order_number: int
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total_paise: int
    item_count: int
    placed_at: datetime
    first_item_images: list[str]


class OrderDetailOut(OrderSummaryOut):
    items: list[OrderItemOut]
    subtotal_paise: int
    delivery_fee_paise: int
    discount_paise: int
    delivery_address: DeliveryAddressOut
    customer_note: str | None
    # Every status the order has reached, oldest first.
    timeline: list[TimelineStep]
    can_cancel: bool
    cancel_reason: str | None


class PlaceOrderOut(BaseModel):
    order: OrderDetailOut
    # Online payment session; always null until Phase 8.
    payment: None = None


# --- admin --------------------------------------------------------------------------------


class AdminOrderRow(BaseModel):
    id: uuid.UUID
    order_number: int
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total_paise: int
    item_count: int
    placed_at: datetime
    customer_name: str
    customer_phone: str
    delivery_area: str  # "Rajpur Road, 248001": enough to plan a delivery run


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str | None


class HistoryEntry(BaseModel):
    from_status: OrderStatus | None
    to_status: OrderStatus
    at: datetime
    actor: Literal["CUSTOMER", "ADMIN", "SYSTEM"]
    actor_name: str | None
    note: str | None


class AdminOrderDetailOut(OrderDetailOut):
    customer: CustomerOut
    history: list[HistoryEntry]
    # What the admin can move this order to next (CANCELLED included while allowed).
    next_statuses: list[OrderStatus]


class OrdersSummaryOut(BaseModel):
    """Polled by the admin every 15 s to announce new orders."""

    pending_count: int
    latest_order_at: datetime | None


class LowStockItem(BaseModel):
    id: uuid.UUID
    name: str
    unit_label: str
    stock_quantity: int
    threshold: int


class DashboardOut(BaseModel):
    today_orders: int
    today_revenue_paise: int  # paid online + delivered COD, placed today (shop timezone)
    status_counts: dict[str, int]  # orders still in progress, by status
    low_stock: list[LowStockItem]
    recent_orders: list[AdminOrderRow]
