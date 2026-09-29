import uuid
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models import MAX_LINE_QUANTITY
from app.schemas.address import AddressOut
from app.schemas.cart import CartLineOut

PaymentMethod = Literal["COD", "ONLINE"]
CheckoutIssueCode = Literal[
    "SHOP_CLOSED",
    "NOT_SERVICEABLE",
    "BELOW_MIN_ORDER",
    "ITEMS_CHANGED",
    "EMPTY_ORDER",
    "NO_PAYMENT_METHOD",
]


class CheckoutItem(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=MAX_LINE_QUANTITY)


class CheckoutQuoteRequest(BaseModel):
    address_id: uuid.UUID
    items: list[CheckoutItem] = Field(min_length=1, max_length=100)

    @field_validator("items")
    @classmethod
    def _unique_products(cls, items: list[CheckoutItem]) -> list[CheckoutItem]:
        if len({item.product_id for item in items}) != len(items):
            raise ValueError("each product may appear only once")
        return items


class CheckoutIssue(BaseModel):
    code: CheckoutIssueCode
    message: str


class CheckoutQuoteOut(BaseModel):
    """Exactly what placing the order would charge right now. Computing it changes nothing."""

    lines: list[CartLineOut]
    item_count: int
    subtotal_paise: int
    delivery_fee_paise: int
    total_paise: int
    address: AddressOut
    payment_methods: list[PaymentMethod]
    # Anything here blocks the order; the app shows the messages as they are.
    issues: list[CheckoutIssue]
    can_place_order: bool
