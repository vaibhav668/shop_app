import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.models import User
from app.schemas.cart import CartLineOut, CartOut, DeliveryRules, SetQuantityRequest
from app.schemas.catalog import ProductCardOut
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.cart import CartService
from app.services.catalog_views import CatalogViews
from app.services.favourites import FavouritesService
from app.services.pricing import PricedLine, Quote
from app.services.shop import get_shop_settings

router = APIRouter(tags=["cart"])


def get_views(
    db: Session = Depends(get_db), storage: StorageProvider = Depends(get_storage)
) -> CatalogViews:
    return CatalogViews(storage, get_shop_settings(db).default_low_stock_threshold)


def line_out(line: PricedLine, views: CatalogViews) -> CartLineOut:
    return CartLineOut(
        product=views.card(line.product),
        quantity=line.quantity,
        available_quantity=line.effective_quantity,
        line_total_paise=line.line_total_paise,
        issue=line.issue,
    )


def _cart_out(result: Quote, views: CatalogViews, db: Session) -> CartOut:
    settings = get_shop_settings(db)
    return CartOut(
        lines=[line_out(line, views) for line in result.lines],
        item_count=result.item_count,
        subtotal_paise=result.subtotal_paise,
        delivery_fee_paise=result.delivery_fee_paise,
        total_paise=result.total_paise,
        free_delivery_remaining_paise=result.free_delivery_remaining_paise,
        min_order_remaining_paise=result.min_order_remaining_paise,
        has_issues=result.has_issues,
        rules=DeliveryRules(
            delivery_fee_paise=settings.delivery_fee_paise,
            free_delivery_above_paise=settings.free_delivery_above_paise,
            min_order_paise=settings.min_order_paise,
        ),
    )


# --- cart ---------------------------------------------------------------------------------


@router.get("/cart", response_model=CartOut)
def get_cart(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> CartOut:
    return _cart_out(CartService(db).view(user), views, db)


@router.put("/cart/items/{product_id}", response_model=CartOut)
def set_item_quantity(
    product_id: uuid.UUID,
    payload: SetQuantityRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> CartOut:
    """Sets an absolute quantity (0 removes). Safe to retry: the same call gives the same cart."""
    return _cart_out(CartService(db).set_quantity(user, product_id, payload.quantity), views, db)


@router.delete("/cart/items/{product_id}", response_model=CartOut)
def remove_item(
    product_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> CartOut:
    return _cart_out(CartService(db).set_quantity(user, product_id, 0), views, db)


@router.delete("/cart", response_model=CartOut)
def clear_cart(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> CartOut:
    return _cart_out(CartService(db).clear(user), views, db)


# --- favourites ---------------------------------------------------------------------------


@router.get("/favourites", response_model=Page[ProductCardOut], tags=["favourites"])
def list_favourites(
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> Page[ProductCardOut]:
    items, total = FavouritesService(db).page(user, limit=limit, offset=offset)
    return Page(items=[views.card(p) for p in items], total=total, limit=limit, offset=offset)


@router.get("/favourites/ids", response_model=list[uuid.UUID], tags=["favourites"])
def favourite_ids(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[uuid.UUID]:
    """Lightweight: lets the app draw filled hearts without fetching full products."""
    return FavouritesService(db).ids(user)


@router.put("/favourites/{product_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["favourites"])
def add_favourite(
    product_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    FavouritesService(db).add(user, product_id)


@router.delete(
    "/favourites/{product_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["favourites"]
)
def remove_favourite(
    product_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    FavouritesService(db).remove(user, product_id)
