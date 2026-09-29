import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models import InventoryReason
from app.schemas.order import AdminOrderRow

# --- stock ---------------------------------------------------------------------------------


class BulkStockRow(BaseModel):
    product_id: uuid.UUID
    stock: int = Field(ge=0, le=100_000)
    # The count the admin started from. If it moved (an order came in), that row is a conflict.
    expected_stock: int = Field(ge=0)


class BulkStockRequest(BaseModel):
    updates: list[BulkStockRow] = Field(min_length=1, max_length=500)

    @field_validator("updates")
    @classmethod
    def _unique_products(cls, rows: list[BulkStockRow]) -> list[BulkStockRow]:
        if len({r.product_id for r in rows}) != len(rows):
            raise ValueError("each product may appear only once")
        return rows


class AppliedStock(BaseModel):
    product_id: uuid.UUID
    stock_quantity: int


class StockConflict(BaseModel):
    product_id: uuid.UUID
    expected: int
    current: int


class BulkStockOut(BaseModel):
    """Rows that matched were saved; conflicting rows were left untouched for the admin to
    decide on. One bad row never blocks the others."""

    applied: list[AppliedStock]
    conflicts: list[StockConflict]


class MovementOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    delta: int
    resulting_stock: int
    reason: InventoryReason
    order_id: uuid.UUID | None
    order_number: int | None
    actor_name: str | None  # null for the system; the customer's name for order movements
    note: str | None
    created_at: datetime


# --- customers -----------------------------------------------------------------------------


class CustomerRow(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str | None
    is_active: bool
    joined_at: datetime
    order_count: int  # placed orders (unpaid online attempts not counted)
    total_spent_paise: int  # paid orders only: delivered COD or paid online
    last_order_at: datetime | None


class CustomerDetailOut(CustomerRow):
    cancelled_count: int
    recent_orders: list[AdminOrderRow]
