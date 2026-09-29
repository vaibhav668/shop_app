"""Every /admin route is admin-only, enforced here once for the whole router.
Section routers (orders, products, inventory, ...) are included here as their phases land."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin
from app.routers.admin import banners, catalog, inventory, orders, settings

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
router.include_router(catalog.router)
router.include_router(banners.router)
router.include_router(settings.router)
router.include_router(orders.router)
router.include_router(inventory.router)
