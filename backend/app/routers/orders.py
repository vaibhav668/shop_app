import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.notifications import get_notifier
from app.dependencies.shop import get_delivery_area
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.models import User
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.schemas.order import (
    CancelOrderRequest,
    OrderDetailOut,
    OrderSummaryOut,
    PlaceOrderOut,
    PlaceOrderRequest,
)
from app.services.addresses import AddressService
from app.services.delivery import DeliveryArea
from app.services.notifications import Notifier
from app.services.orders import OrderService, OrderViews

router = APIRouter(prefix="/orders", tags=["orders"])


def get_service(
    db: Session = Depends(get_db),
    area: DeliveryArea = Depends(get_delivery_area),
    notifier: Notifier = Depends(get_notifier),
) -> OrderService:
    return OrderService(db, AddressService(db, area), notifier)


def get_views(storage: StorageProvider = Depends(get_storage)) -> OrderViews:
    return OrderViews(storage)


@router.post("", response_model=PlaceOrderOut, status_code=status.HTTP_201_CREATED)
def place_order(
    payload: PlaceOrderRequest,
    response: Response,
    user: User = Depends(get_current_user),
    service: OrderService = Depends(get_service),
    views: OrderViews = Depends(get_views),
) -> PlaceOrderOut:
    """Prices, stock and delivery rules are checked again here, inside one transaction.
    Resending the same `idempotency_key` returns the original order with 200."""
    order, created = service.place(user, payload)
    if not created:
        response.status_code = status.HTTP_200_OK
    return PlaceOrderOut(order=views.detail(order))


@router.get("", response_model=Page[OrderSummaryOut])
def list_orders(
    scope: Literal["active", "past"] = "active",
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    service: OrderService = Depends(get_service),
    views: OrderViews = Depends(get_views),
) -> Page[OrderSummaryOut]:
    orders, total = service.page(user, scope, limit=limit, offset=offset)
    return Page(items=[views.summary(o) for o in orders], total=total, limit=limit, offset=offset)


@router.get("/{order_id}", response_model=OrderDetailOut)
def get_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: OrderService = Depends(get_service),
    views: OrderViews = Depends(get_views),
) -> OrderDetailOut:
    return views.detail(service.get(user, order_id))


@router.post("/{order_id}/cancel", response_model=OrderDetailOut)
def cancel_order(
    order_id: uuid.UUID,
    payload: CancelOrderRequest,
    user: User = Depends(get_current_user),
    service: OrderService = Depends(get_service),
    views: OrderViews = Depends(get_views),
) -> OrderDetailOut:
    """Allowed only before the shop accepts the order; the stock goes back on the shelf."""
    return views.detail(service.cancel(user, order_id, payload.reason))
