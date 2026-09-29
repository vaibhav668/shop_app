import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import utcnow
from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.models import OrderStatus, PaymentStatus, User
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.schemas.order import (
    AdminOrderDetailOut,
    AdminOrderRow,
    DashboardOut,
    OrdersSummaryOut,
    StatusChangeRequest,
)
from app.services.admin_orders import AdminOrderService
from app.services.orders import OrderViews

router = APIRouter()


def get_service(
    db: Session = Depends(get_db),
    storage: StorageProvider = Depends(get_storage),
    settings: Settings = Depends(get_settings),
) -> AdminOrderService:
    return AdminOrderService(db, OrderViews(storage), settings.shop_timezone)


@router.get("/orders", response_model=Page[AdminOrderRow])
def list_orders(
    status: OrderStatus | None = None,
    payment_status: PaymentStatus | None = None,
    q: str | None = Query(None, max_length=80),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    service: AdminOrderService = Depends(get_service),
) -> Page[AdminOrderRow]:
    """Newest first. Without `status`, unpaid online orders (AWAITING_PAYMENT) are hidden.
    `q` matches the order number, customer name or phone. Dates are in the shop's timezone."""
    rows, total = service.page(
        status=status,
        payment_status=payment_status,
        q=q,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return Page(items=rows, total=total, limit=limit, offset=offset)


@router.get("/orders/summary", response_model=OrdersSummaryOut)
def orders_summary(service: AdminOrderService = Depends(get_service)) -> OrdersSummaryOut:
    return service.summary()


@router.get("/orders/{order_id}", response_model=AdminOrderDetailOut)
def get_order(
    order_id: uuid.UUID, service: AdminOrderService = Depends(get_service)
) -> AdminOrderDetailOut:
    return service.detail(service.get(order_id))


@router.patch("/orders/{order_id}/status", response_model=AdminOrderDetailOut)
def change_status(
    order_id: uuid.UUID,
    payload: StatusChangeRequest,
    admin: User = Depends(require_admin),
    service: AdminOrderService = Depends(get_service),
) -> AdminOrderDetailOut:
    """Moves the order one step. Cancelling needs a `note` (shown to the customer) and puts
    the stock back."""
    order = service.change_status(order_id, payload.to_status, admin, payload.note)
    return service.detail(order)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(service: AdminOrderService = Depends(get_service)) -> DashboardOut:
    return service.dashboard(utcnow())
