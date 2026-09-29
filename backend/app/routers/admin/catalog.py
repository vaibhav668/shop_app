import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.models import User
from app.schemas.admin_catalog import (
    AdminCategoryOut,
    AdminProductOut,
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductStatus,
    ProductUpdate,
    ReorderRequest,
    StockAdjustRequest,
    StockOut,
    StockSetRequest,
    UploadOut,
)
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.admin_catalog import AdminCatalogService
from app.services.catalog_views import CatalogViews
from app.services.inventory import InventoryService
from app.services.shop import get_shop_settings
from app.utils.images import OUTPUT_CONTENT_TYPE, OUTPUT_EXTENSION, normalise_image

router = APIRouter()


def get_service(
    db: Session = Depends(get_db), storage: StorageProvider = Depends(get_storage)
) -> AdminCatalogService:
    return AdminCatalogService(db, storage)


def get_views(
    db: Session = Depends(get_db), storage: StorageProvider = Depends(get_storage)
) -> CatalogViews:
    return CatalogViews(storage, get_shop_settings(db).default_low_stock_threshold)


# --- uploads ------------------------------------------------------------------------------


@router.post("/uploads/images", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...), storage: StorageProvider = Depends(get_storage)
) -> UploadOut:
    data = normalise_image(await file.read())
    key = f"catalog/{uuid.uuid4().hex}.{OUTPUT_EXTENSION}"
    storage.save(data, key=key, content_type=OUTPUT_CONTENT_TYPE)
    return UploadOut(key=key, url=storage.url(key, width=400))


# --- categories ---------------------------------------------------------------------------


@router.get("/categories", response_model=list[AdminCategoryOut])
def list_categories(
    service: AdminCatalogService = Depends(get_service), views: CatalogViews = Depends(get_views)
) -> list[AdminCategoryOut]:
    return [views.admin_category(c, n) for c, n in service.list_categories()]


@router.post("/categories", response_model=AdminCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminCategoryOut:
    return views.admin_category(service.create_category(payload), 0)


@router.patch("/categories/{category_id}", response_model=AdminCategoryOut)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminCategoryOut:
    category = service.update_category(category_id, payload)
    return views.admin_category(category, service.product_count(category_id))


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: uuid.UUID, service: AdminCatalogService = Depends(get_service)
) -> None:
    service.delete_category(category_id)


@router.post("/categories/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_categories(
    payload: ReorderRequest, service: AdminCatalogService = Depends(get_service)
) -> None:
    service.reorder_categories(payload.ids)


# --- products -----------------------------------------------------------------------------


@router.get("/products", response_model=Page[AdminProductOut])
def list_products(
    q: str | None = Query(None, max_length=100),
    category_id: uuid.UUID | None = None,
    status: ProductStatus = "all",
    low_stock: bool = False,
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> Page[AdminProductOut]:
    items, total = service.list_products(
        q=q,
        category_id=category_id,
        status=status,
        low_stock=low_stock,
        settings=get_shop_settings(db),
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[views.admin_product(p) for p in items], total=total, limit=limit, offset=offset
    )


@router.post("/products", response_model=AdminProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    admin: User = Depends(require_admin),
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminProductOut:
    return views.admin_product(service.create_product(payload, admin.id))


@router.get("/products/{product_id}", response_model=AdminProductOut)
def get_product(
    product_id: uuid.UUID,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminProductOut:
    return views.admin_product(service.get_product(product_id))


@router.patch("/products/{product_id}", response_model=AdminProductOut)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminProductOut:
    return views.admin_product(service.update_product(product_id, payload))


@router.delete("/products/{product_id}", response_model=AdminProductOut)
def archive_product(
    product_id: uuid.UUID,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminProductOut:
    """Archives rather than deletes: past orders keep pointing at the product."""
    return views.admin_product(service.archive_product(product_id))


@router.post("/products/{product_id}/restore", response_model=AdminProductOut)
def restore_product(
    product_id: uuid.UUID,
    service: AdminCatalogService = Depends(get_service),
    views: CatalogViews = Depends(get_views),
) -> AdminProductOut:
    return views.admin_product(service.restore_product(product_id))


# --- stock --------------------------------------------------------------------------------


@router.patch("/products/{product_id}/stock", response_model=StockOut)
def set_stock(
    product_id: uuid.UUID,
    payload: StockSetRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StockOut:
    stock = InventoryService(db).set_stock(
        product_id, new_stock=payload.stock, expected=payload.expected_stock, actor_id=admin.id
    )
    db.commit()
    return StockOut(product_id=product_id, stock_quantity=stock)


@router.post("/products/{product_id}/stock-adjust", response_model=StockOut)
def adjust_stock(
    product_id: uuid.UUID,
    payload: StockAdjustRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StockOut:
    stock = InventoryService(db).adjust(
        product_id, delta=payload.delta, actor_id=admin.id, note=payload.note
    )
    db.commit()
    return StockOut(product_id=product_id, stock_quantity=stock)
