from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, field_validator

from app.schemas.address import Pincode
from app.schemas.common import blank_to_none

ShopName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ClosedMessage = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
ShopPhone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9 -]{8,16}$")]
ShopAddress = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
# ₹10,000 ceiling guards typos (a fee typed in rupees-and-paise by mistake, say).
FeePaise = Annotated[int, Field(ge=0, le=1_000_000)]


class AdminSettingsOut(BaseModel):
    shop_name: str
    shop_phone: str | None
    shop_address: str | None
    is_accepting_orders: bool
    closed_message: str
    delivery_fee_paise: int
    free_delivery_above_paise: int
    min_order_paise: int
    delivery_eta_minutes: int
    serviceable_pincodes: list[str]
    # False in staging/production: there an empty pincode list means no delivery anywhere.
    empty_pincodes_accept_all: bool
    cod_enabled: bool
    online_payment_enabled: bool
    payment_timeout_minutes: int
    default_low_stock_threshold: int
    updated_at: datetime | None


class AdminSettingsUpdate(BaseModel):
    """Only the fields sent are changed."""

    shop_name: ShopName | None = None
    shop_phone: Annotated[ShopPhone | None, BeforeValidator(blank_to_none)] = None
    shop_address: Annotated[ShopAddress | None, BeforeValidator(blank_to_none)] = None
    is_accepting_orders: bool | None = None
    closed_message: ClosedMessage | None = None
    delivery_fee_paise: FeePaise | None = None
    free_delivery_above_paise: FeePaise | None = None
    min_order_paise: FeePaise | None = None
    delivery_eta_minutes: int | None = Field(default=None, ge=5, le=240)
    serviceable_pincodes: list[Pincode] | None = Field(default=None, max_length=500)
    cod_enabled: bool | None = None
    online_payment_enabled: bool | None = None
    payment_timeout_minutes: int | None = Field(default=None, ge=5, le=60)
    default_low_stock_threshold: int | None = Field(default=None, ge=0, le=1000)

    @field_validator("serviceable_pincodes")
    @classmethod
    def _dedupe_and_sort(cls, pincodes: list[str] | None) -> list[str] | None:
        return sorted(set(pincodes)) if pincodes is not None else None
