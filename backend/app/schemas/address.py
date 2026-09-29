import uuid
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, StringConstraints

from app.schemas.auth import IndianMobile
from app.schemas.common import blank_to_none


def _text(max_length: int) -> StringConstraints:
    return StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)


Label = Annotated[str, _text(30)]
PersonName = Annotated[str, _text(80)]
Line = Annotated[str, _text(200)]
Place = Annotated[str, _text(60)]
OptionalLine = Annotated[Annotated[str, _text(200)] | None, BeforeValidator(blank_to_none)]
OptionalLandmark = Annotated[Annotated[str, _text(120)] | None, BeforeValidator(blank_to_none)]
# Indian PIN codes are six digits and never start with 0.
Pincode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[1-9]\d{5}$")]


class AddressOut(BaseModel):
    id: uuid.UUID
    label: str
    recipient_name: str
    phone: str
    line1: str
    line2: str | None
    landmark: str | None
    city: str
    state: str
    pincode: str
    is_default: bool
    # Whether the shop delivers to this pincode right now.
    is_serviceable: bool


class AddressCreate(BaseModel):
    label: Label = "Home"
    recipient_name: PersonName
    phone: IndianMobile
    line1: Line
    line2: OptionalLine = None
    landmark: OptionalLandmark = None
    city: Place
    state: Place
    pincode: Pincode
    is_default: bool = False


class AddressUpdate(BaseModel):
    """Only the fields sent are changed. Use POST /addresses/{id}/default to change the default."""

    label: Label | None = None
    recipient_name: PersonName | None = None
    phone: IndianMobile | None = None
    line1: Line | None = None
    line2: OptionalLine = None
    landmark: OptionalLandmark = None
    city: Place | None = None
    state: Place | None = None
    pincode: Pincode | None = None
