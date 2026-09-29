"""Customer-facing catalog DTOs. Built by app.services.catalog_views, never from ORM directly,
because image URLs and stock hints need the storage provider and shop settings."""

import uuid
from typing import Literal

from pydantic import BaseModel

StockHint = Literal["IN_STOCK", "LOW", "OUT"]


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    image_url: str | None


class CategoryRef(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


class ProductCardOut(BaseModel):
    id: uuid.UUID
    name: str
    unit_label: str
    price_paise: int
    mrp_paise: int
    discount_percent: int
    image_url: str | None
    is_available: bool
    # Customers see a hint, never the exact stock count.
    stock_hint: StockHint
    max_per_order: int | None


class ProductDetailOut(ProductCardOut):
    description: str | None
    category: CategoryRef
    related: list[ProductCardOut]


class ShopOut(BaseModel):
    name: str
    phone: str | None
    is_accepting_orders: bool
    closed_message: str
    delivery_fee_paise: int
    free_delivery_above_paise: int
    min_order_paise: int
    cod_enabled: bool
    online_payment_enabled: bool
