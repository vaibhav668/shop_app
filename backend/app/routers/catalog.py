"""Public, read-only catalog. Hidden, archived and hidden-category products never appear."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.repositories import catalog as repo
from app.schemas.catalog import CategoryOut, ProductCardOut, ProductDetailOut, ShopOut
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.catalog_views import CatalogViews
from app.services.shop import get_shop_settings

router = APIRouter(tags=["catalog"])


def get_views(
    db: Session = Depends(get_db), storage: StorageProvider = Depends(get_storage)
) -> CatalogViews:
    return CatalogViews(storage, get_shop_settings(db).default_low_stock_threshold)


@router.get("/shop", response_model=ShopOut)
def get_shop(db: Session = Depends(get_db)) -> ShopOut:
    s = get_shop_settings(db)
    return ShopOut(
        name=s.shop_name,
        phone=s.shop_phone,
        is_accepting_orders=s.is_accepting_orders,
        closed_message=s.closed_message,
        delivery_fee_paise=s.delivery_fee_paise,
        free_delivery_above_paise=s.free_delivery_above_paise,
        min_order_paise=s.min_order_paise,
        cod_enabled=s.cod_enabled,
        online_payment_enabled=s.online_payment_enabled,
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db), views: CatalogViews = Depends(get_views)
) -> list[CategoryOut]:
    return [views.category(c) for c in repo.list_active_categories(db)]


@router.get("/categories/{slug}", response_model=CategoryOut)
def get_category(
    slug: str, db: Session = Depends(get_db), views: CatalogViews = Depends(get_views)
) -> CategoryOut:
    category = repo.get_active_category_by_slug(db, slug)
    if category is None:
        raise AppError("NOT_FOUND", "Category not found.", 404)
    return views.category(category)


@router.get("/products", response_model=Page[ProductCardOut])
def list_products(
    category_id: uuid.UUID | None = None,
    in_stock_only: bool = False,
    sort: repo.CustomerSort = "default",
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> Page[ProductCardOut]:
    items, total = repo.list_customer_products(
        db,
        category_id=category_id,
        in_stock_only=in_stock_only,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return Page(items=[views.card(p) for p in items], total=total, limit=limit, offset=offset)


@router.get("/products/{product_id}", response_model=ProductDetailOut)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    views: CatalogViews = Depends(get_views),
) -> ProductDetailOut:
    product = repo.get_customer_product(db, product_id)
    if product is None:
        raise AppError("NOT_FOUND", "This product isn't available.", 404)
    return views.detail(product, repo.list_related(db, product))
