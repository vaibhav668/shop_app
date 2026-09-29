import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
UnitLabel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
ImageKey = Annotated[str, StringConstraints(pattern=r"^catalog/[0-9a-f]{32}\.webp$")]
Paise = Annotated[int, Field(gt=0, le=10_000_000)]  # ₹1,00,000 ceiling guards typos


# --- categories ---------------------------------------------------------------------------


class AdminCategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    image_key: str | None
    image_url: str | None
    sort_order: int
    is_active: bool
    product_count: int


class CategoryCreate(BaseModel):
    name: Name
    image_key: ImageKey | None = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Name | None = None
    image_key: ImageKey | None = None
    remove_image: bool = False
    is_active: bool | None = None


class ReorderRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


# --- products -----------------------------------------------------------------------------


class AdminProductOut(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    name: str
    slug: str
    description: str | None
    unit_label: str
    price_paise: int
    mrp_paise: int
    stock_quantity: int
    low_stock_threshold: int | None
    max_per_order: int | None
    is_active: bool
    is_featured: bool
    is_low_stock: bool
    image_key: str | None
    image_url: str | None
    search_keywords: str | None
    archived_at: datetime | None
    updated_at: datetime


class _PriceRule(BaseModel):
    @model_validator(mode="after")
    def _mrp_not_below_price(self):
        price = getattr(self, "price_paise", None)
        mrp = getattr(self, "mrp_paise", None)
        if price is not None and mrp is not None and mrp < price:
            raise ValueError("MRP can't be lower than the selling price.")
        return self


class ProductCreate(_PriceRule):
    category_id: uuid.UUID
    name: Name
    unit_label: UnitLabel
    price_paise: Paise
    mrp_paise: Paise
    stock_quantity: int = Field(default=0, ge=0, le=100_000)
    description: OptionalText | None = None
    image_key: ImageKey | None = None
    search_keywords: OptionalText | None = None
    low_stock_threshold: int | None = Field(default=None, ge=0, le=10_000)
    max_per_order: int | None = Field(default=None, ge=1, le=50)
    is_active: bool = True
    is_featured: bool = False


class ProductUpdate(_PriceRule):
    """Stock is not editable here: it goes through the stock endpoints so every change is logged."""

    category_id: uuid.UUID | None = None
    name: Name | None = None
    unit_label: UnitLabel | None = None
    price_paise: Paise | None = None
    mrp_paise: Paise | None = None
    description: OptionalText | None = None
    image_key: ImageKey | None = None
    remove_image: bool = False
    search_keywords: OptionalText | None = None
    low_stock_threshold: int | None = Field(default=None, ge=0, le=10_000)
    max_per_order: int | None = Field(default=None, ge=1, le=50)
    is_active: bool | None = None
    is_featured: bool | None = None


ProductStatus = Literal["active", "inactive", "archived", "all"]


# --- stock --------------------------------------------------------------------------------


class StockSetRequest(BaseModel):
    stock: int = Field(ge=0, le=100_000)
    # What the admin saw when they started editing; a mismatch means an order came in.
    expected_stock: int = Field(ge=0)


class StockAdjustRequest(BaseModel):
    delta: int = Field(ge=-100_000, le=100_000)
    note: OptionalText | None = None

    @model_validator(mode="after")
    def _non_zero(self):
        if self.delta == 0:
            raise ValueError("Change must not be zero.")
        return self


class StockOut(BaseModel):
    product_id: uuid.UUID
    stock_quantity: int


class UploadOut(BaseModel):
    key: str
    url: str
