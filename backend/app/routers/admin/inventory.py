import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.models import User
from app.routers.admin.orders import get_service as get_order_service
from app.schemas.admin_inventory import (
    AppliedStock,
    BulkStockOut,
    BulkStockRequest,
    CustomerDetailOut,
    CustomerRow,
    MovementOut,
    StockConflict,
)
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.admin_inventory import CustomerService, movements_page
from app.services.admin_orders import AdminOrderService
from app.services.inventory import InventoryService

router = APIRouter()


@router.post("/inventory/bulk", response_model=BulkStockOut)
def bulk_set_stock(
    payload: BulkStockRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> BulkStockOut:
    """Quick Stock save. Each row applies only if the stock still equals `expected_stock`;
    the others come back in `conflicts` with the current count, unchanged."""
    applied, conflicts = InventoryService(db).bulk_set(
        [(r.product_id, r.stock, r.expected_stock) for r in payload.updates], actor_id=admin.id
    )
    db.commit()
    return BulkStockOut(
        applied=[AppliedStock(product_id=i, stock_quantity=s) for i, s in applied],
        conflicts=[StockConflict(product_id=i, expected=e, current=c) for i, e, c in conflicts],
    )


@router.get("/inventory/movements", response_model=Page[MovementOut])
def list_movements(
    product_id: uuid.UUID | None = None,
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Page[MovementOut]:
    items, total = movements_page(db, product_id=product_id, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


def get_customers(
    db: Session = Depends(get_db), orders: AdminOrderService = Depends(get_order_service)
) -> CustomerService:
    return CustomerService(db, orders)


@router.get("/customers", response_model=Page[CustomerRow])
def list_customers(
    q: str | None = Query(None, max_length=80),
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    service: CustomerService = Depends(get_customers),
) -> Page[CustomerRow]:
    """Most recent buyers first. `q` matches name, email or phone."""
    items, total = service.page(q=q, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/customers/{customer_id}", response_model=CustomerDetailOut)
def get_customer(
    customer_id: uuid.UUID, service: CustomerService = Depends(get_customers)
) -> CustomerDetailOut:
    return service.detail(customer_id)
