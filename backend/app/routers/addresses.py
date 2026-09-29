import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.shop import get_delivery_area
from app.models import User
from app.schemas.address import AddressCreate, AddressOut, AddressUpdate
from app.services.addresses import AddressService
from app.services.delivery import DeliveryArea

router = APIRouter(prefix="/addresses", tags=["addresses"])


def get_service(
    db: Session = Depends(get_db), area: DeliveryArea = Depends(get_delivery_area)
) -> AddressService:
    return AddressService(db, area)


@router.get("", response_model=list[AddressOut])
def list_addresses(
    user: User = Depends(get_current_user), service: AddressService = Depends(get_service)
) -> list[AddressOut]:
    """The default address comes first, then the newest."""
    return [service.out(a) for a in service.list(user)]


@router.post("", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressCreate,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_service),
) -> AddressOut:
    """The first address becomes the default. Unserviceable pincodes are saved but flagged."""
    return service.out(service.create(user, payload))


@router.patch("/{address_id}", response_model=AddressOut)
def update_address(
    address_id: uuid.UUID,
    payload: AddressUpdate,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_service),
) -> AddressOut:
    return service.out(service.update(user, address_id, payload))


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_service),
) -> None:
    """Deleting the default promotes the most recently used remaining address."""
    service.delete(user, address_id)


@router.post("/{address_id}/default", response_model=AddressOut)
def set_default_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_service),
) -> AddressOut:
    return service.out(service.set_default(user, address_id))
