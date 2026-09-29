from typing import Literal

from pydantic import BaseModel, Field

from app.models import MAX_LINE_QUANTITY
from app.schemas.catalog import ProductCardOut


class CartLineOut(BaseModel):
    product: ProductCardOut
    quantity: int
    # What can be sold right now; lower than `quantity` when stock dropped.
    available_quantity: int
    line_total_paise: int
    issue: Literal["UNAVAILABLE", "OUT_OF_STOCK", "QUANTITY_REDUCED"] | None


class DeliveryRules(BaseModel):
    """Sent so the app can estimate totals instantly while a change is in flight."""

    delivery_fee_paise: int
    free_delivery_above_paise: int
    min_order_paise: int


class CartOut(BaseModel):
    lines: list[CartLineOut]
    item_count: int
    subtotal_paise: int
    delivery_fee_paise: int
    total_paise: int
    free_delivery_remaining_paise: int
    min_order_remaining_paise: int
    has_issues: bool
    rules: DeliveryRules


class SetQuantityRequest(BaseModel):
    quantity: int = Field(ge=0, le=MAX_LINE_QUANTITY, description="0 removes the item")
