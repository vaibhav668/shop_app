"""A customer's saved addresses. Another user's address is always reported as not found."""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import MAX_ADDRESSES_PER_USER, Address, User
from app.schemas.address import AddressCreate, AddressOut, AddressUpdate
from app.services.delivery import DeliveryArea

# Fields a PATCH may clear by sending null or "".
_NULLABLE = {"line2", "landmark"}


class AddressService:
    def __init__(self, db: Session, area: DeliveryArea) -> None:
        self.db = db
        self.area = area

    def out(self, address: Address) -> AddressOut:
        return AddressOut(
            id=address.id,
            label=address.label,
            recipient_name=address.recipient_name,
            phone=address.phone,
            line1=address.line1,
            line2=address.line2,
            landmark=address.landmark,
            city=address.city,
            state=address.state,
            pincode=address.pincode,
            is_default=address.is_default,
            is_serviceable=self.area.covers(address.pincode),
        )

    def list(self, user: User) -> list[Address]:
        return list(
            self.db.scalars(
                select(Address)
                .where(Address.user_id == user.id)
                .order_by(Address.is_default.desc(), Address.created_at.desc())
            )
        )

    def get(self, user: User, address_id: uuid.UUID) -> Address:
        address = self.db.scalar(
            select(Address).where(Address.id == address_id, Address.user_id == user.id)
        )
        if address is None:
            raise AppError("NOT_FOUND", "Address not found.", 404)
        return address

    def create(self, user: User, data: AddressCreate) -> Address:
        self._lock(user)
        count = self.db.scalar(select(func.count()).where(Address.user_id == user.id)) or 0
        if count >= MAX_ADDRESSES_PER_USER:
            raise AppError(
                "ADDRESS_LIMIT",
                f"You can save up to {MAX_ADDRESSES_PER_USER} addresses. "
                "Remove one to add another.",
                409,
            )
        make_default = data.is_default or count == 0  # the first address is the default
        if make_default:
            self._clear_default(user)
        address = Address(
            user_id=user.id,
            **data.model_dump(exclude={"is_default"}),
            is_default=make_default,
        )
        self.db.add(address)
        self.db.commit()
        return address

    def update(self, user: User, address_id: uuid.UUID, data: AddressUpdate) -> Address:
        address = self.get(user, address_id)
        for field in data.model_fields_set:
            value = getattr(data, field)
            if value is None and field not in _NULLABLE:
                continue  # required fields can't be cleared; null means "unchanged"
            setattr(address, field, value)
        self.db.commit()
        return address

    def delete(self, user: User, address_id: uuid.UUID) -> None:
        self._lock(user)
        address = self.get(user, address_id)
        was_default = address.is_default
        self.db.delete(address)
        self.db.flush()
        if was_default:
            # Promote the most recently used remaining address (newest if none used yet).
            successor = self.db.scalar(
                select(Address)
                .where(Address.user_id == user.id)
                .order_by(
                    Address.last_used_at.desc().nulls_last(),
                    Address.created_at.desc(),
                )
                .limit(1)
            )
            if successor is not None:
                successor.is_default = True
        self.db.commit()

    def set_default(self, user: User, address_id: uuid.UUID) -> Address:
        self._lock(user)
        address = self.get(user, address_id)
        if not address.is_default:
            self._clear_default(user)
            address.is_default = True
        self.db.commit()
        return address

    def _clear_default(self, user: User) -> None:
        # Flushed before the new default is set, so the one-default index never sees two.
        self.db.execute(
            update(Address)
            .where(Address.user_id == user.id, Address.is_default)
            .values(is_default=False)
            .execution_options(synchronize_session="fetch")
        )

    def _lock(self, user: User) -> None:
        """Serialises one user's address changes (two devices setting a default at once)."""
        self.db.execute(select(User.id).where(User.id == user.id).with_for_update())
