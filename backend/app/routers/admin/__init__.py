"""Every /admin route is admin-only, enforced here once for the whole router.
Section routers (orders, products, inventory, ...) are included here as their phases land."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
