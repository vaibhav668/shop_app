"""Public, read-only catalog. Hidden, archived and hidden-category products never appear."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.repositories import catalog as repo
from app.schemas.catalog import (
    CategoryOut,
    HomeOut,
    ProductCardOut,
    ProductDetailOut,
    ShopOut,
    SuggestionOut,
)
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.banners import BannerService
from app.services.catalog_views import CARD_IMAGE_WIDTH, CatalogViews
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


@router.get("/home", response_model=HomeOut)
def get_home(
    db: Session = Depends(get_db),
    storage: StorageProvider = Depends(get_storage),
    views: CatalogViews = Depends(get_views),
) -> HomeOut:
    """Everything the home screen needs in one round trip."""
    return HomeOut(
        banners=BannerService(db, storage).live_banners(),
        categories=[views.category(c) for c in repo.list_active_categories(db)],
        featured=[views.card(p) for p in repo.list_featured(db)],
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
    q: str | None = Query(None, max_length=60, description="Search text; ranks by relevance"),
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
        q=q,
    )
    return Page(items=[views.card(p) for p in items], total=total, limit=limit, offset=offset)


# Declared before /products/{product_id} so "suggest" isn't parsed as a product id.
@router.get("/products/suggest", response_model=list[SuggestionOut])
def suggest_products(
    q: str = Query(min_length=1, max_length=60),
    db: Session = Depends(get_db),
    storage: StorageProvider = Depends(get_storage),
) -> list[SuggestionOut]:
    return [
        SuggestionOut(
            id=p.id,
            name=p.name,
            unit_label=p.unit_label,
            image_url=storage.url(p.image_key, width=CARD_IMAGE_WIDTH // 4)
            if p.image_key
            else None,
        )
        for p in repo.suggest_products(db, q)
    ]


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
