from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.models import User
from app.repositories import catalog as catalog_repo
from app.schemas.auth import DeviceRegistration, UpdateMeRequest, UserOut
from app.schemas.catalog import ProductCardOut
from app.services.catalog_views import CatalogViews
from app.services.shop import get_shop_settings
from app.services.users import UserService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("", response_model=UserOut)
def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return UserService(db).update_profile(user, name=payload.name, phone=payload.phone)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    UserService(db).delete_account(user)


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    payload: DeviceRegistration,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    UserService(db).register_device(user, payload.token, payload.platform)


@router.delete("/devices/{token}", status_code=status.HTTP_204_NO_CONTENT)
def remove_device(
    token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    UserService(db).remove_device(user, token)


@router.get("/buy-again", response_model=list[ProductCardOut])
def buy_again(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageProvider = Depends(get_storage),
) -> list[ProductCardOut]:
    """What this customer orders most, for the home "Buy again" rail. Empty for new customers."""
    views = CatalogViews(storage, get_shop_settings(db).default_low_stock_threshold)
    ids = catalog_repo.buy_again_product_ids(db, user.id)
    return [views.card(p) for p in catalog_repo.list_visible_by_ids(db, ids)]
