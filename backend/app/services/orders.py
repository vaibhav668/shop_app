"""Placing orders and the customer's view of them. Order placement is one transaction: products
are locked in id order, prices come from PricingService, stock from InventoryService."""

import uuid
from typing import Literal

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.errors import AppError
from app.core.security import utcnow
from app.integrations.storage import StorageProvider
from app.models import (
    TERMINAL_STATUSES,
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    PaymentStatus,
    Product,
    User,
)
from app.schemas.order import (
    DeliveryAddressOut,
    OrderDetailOut,
    OrderItemOut,
    OrderSummaryOut,
    PlaceOrderRequest,
    TimelineStep,
)
from app.services.addresses import AddressService
from app.services.checkout import enabled_payment_methods
from app.services.inventory import InventoryService
from app.services.order_state import (
    CUSTOMER_CANCELLABLE,
    Actor,
    ActorKind,
    OrderStateMachine,
)
from app.services.pricing import quote
from app.services.shop import get_shop_settings
from app.utils.money import format_rupees

ORDER_IMAGE_WIDTH = 200
Scope = Literal["active", "past"]


def with_details():
    """Loader options for everything an order detail shows."""
    return (
        selectinload(Order.items),
        selectinload(Order.history).joinedload(OrderStatusHistory.actor),
    )


class OrderViews:
    def __init__(self, storage: StorageProvider) -> None:
        self.storage = storage

    def _image(self, key: str | None) -> str | None:
        return self.storage.url(key, width=ORDER_IMAGE_WIDTH) if key else None

    def summary(self, order: Order) -> OrderSummaryOut:
        return OrderSummaryOut(**self._summary_fields(order))

    def _summary_fields(self, order: Order) -> dict:
        images = [self._image(i.image_key) for i in order.items if i.image_key][:4]
        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "total_paise": order.total_paise,
            "item_count": sum(i.quantity for i in order.items),
            "placed_at": order.placed_at,
            "first_item_images": [url for url in images if url],
        }

    def detail_fields(self, order: Order) -> dict:
        return self._summary_fields(order) | {
            "items": [
                OrderItemOut(
                    product_id=i.product_id,
                    name=i.product_name,
                    unit_label=i.unit_label,
                    image_url=self._image(i.image_key),
                    unit_price_paise=i.unit_price_paise,
                    mrp_paise=i.mrp_paise,
                    quantity=i.quantity,
                    line_total_paise=i.line_total_paise,
                )
                for i in order.items
            ],
            "subtotal_paise": order.subtotal_paise,
            "delivery_fee_paise": order.delivery_fee_paise,
            "discount_paise": order.discount_paise,
            "delivery_address": DeliveryAddressOut(
                name=order.delivery_name,
                phone=order.delivery_phone,
                line1=order.delivery_line1,
                line2=order.delivery_line2,
                landmark=order.delivery_landmark,
                city=order.delivery_city,
                state=order.delivery_state,
                pincode=order.delivery_pincode,
            ),
            "customer_note": order.customer_note,
            "timeline": [TimelineStep(status=h.to_status, at=h.created_at) for h in order.history],
            "can_cancel": order.status in CUSTOMER_CANCELLABLE,
            "cancel_reason": order.cancel_reason,
        }

    def detail(self, order: Order) -> OrderDetailOut:
        return OrderDetailOut(**self.detail_fields(order))


class OrderService:
    def __init__(self, db: Session, addresses: AddressService) -> None:
        self.db = db
        self.addresses = addresses

    # --- placing ----------------------------------------------------------------------------

    def place(self, user: User, request: PlaceOrderRequest) -> tuple[Order, bool]:
        """Returns (order, created). Repeating an idempotency key returns the original order."""
        existing = self._by_key(user, request.idempotency_key)
        if existing is not None:
            return existing, False
        try:
            order = self._place(user, request)
        except IntegrityError:
            # A double tap raced us to the same idempotency key: return the winner's order.
            self.db.rollback()
            existing = self._by_key(user, request.idempotency_key)
            if existing is None:
                raise
            return existing, False
        return self.get(user, order.id), True

    def _place(self, user: User, request: PlaceOrderRequest) -> Order:
        if not user.phone:
            raise AppError("PHONE_REQUIRED", "Add your mobile number before ordering.", 422)
        address = self.addresses.get(user, request.address_id)
        settings = get_shop_settings(self.db)
        if not settings.is_accepting_orders:
            raise AppError("SHOP_CLOSED", settings.closed_message, 422)
        if not self.addresses.area.covers(address.pincode):
            raise AppError(
                "NOT_SERVICEABLE", f"Sorry, we don't deliver to {address.pincode} yet.", 422
            )
        if request.payment_method.value not in enabled_payment_methods(settings):
            raise AppError(
                "PAYMENT_METHOD_DISABLED", "This payment method isn't available right now.", 422
            )

        # Lock every product in id order so two checkouts can't deadlock or oversell.
        ids = sorted(item.product_id for item in request.items)
        products = {
            p.id: p
            for p in self.db.scalars(
                select(Product)
                .options(joinedload(Product.category, innerjoin=True))
                .where(Product.id.in_(ids))
                .order_by(Product.id)
                .with_for_update(of=Product)
            )
        }
        wanted = []
        for item in request.items:
            product = products.get(item.product_id)
            if product is None:
                raise _unavailable(item.product_id)
            wanted.append((product, item.quantity))

        result = quote(wanted, settings)
        for line in result.lines:
            _raise_for_issue(line.product, line.quantity, line.issue, line.effective_quantity)
        if result.min_order_remaining_paise > 0:
            raise AppError(
                "BELOW_MIN_ORDER",
                f"Minimum order is {format_rupees(settings.min_order_paise)}.",
                422,
                {"min_order_paise": settings.min_order_paise},
            )
        if result.total_paise != request.expected_total_paise:
            raise AppError(
                "PRICE_CHANGED",
                "Prices changed since you opened checkout. Please check the new total.",
                409,
                {
                    "expected_total_paise": request.expected_total_paise,
                    "total_paise": result.total_paise,
                },
            )

        now = utcnow()
        order = Order(
            user_id=user.id,
            status=OrderStatus.PENDING,
            payment_method=request.payment_method,
            payment_status=PaymentStatus.PENDING,
            subtotal_paise=result.subtotal_paise,
            delivery_fee_paise=result.delivery_fee_paise,
            discount_paise=0,
            total_paise=result.total_paise,
            delivery_name=address.recipient_name,
            delivery_phone=address.phone,
            delivery_line1=address.line1,
            delivery_line2=address.line2,
            delivery_landmark=address.landmark,
            delivery_city=address.city,
            delivery_state=address.state,
            delivery_pincode=address.pincode,
            customer_note=request.customer_note,
            idempotency_key=request.idempotency_key,
            placed_at=now,
        )
        order.items = [
            OrderItem(
                product_id=line.product.id,
                position=position,
                product_name=line.product.name,
                unit_label=line.product.unit_label,
                image_key=line.product.image_key,
                unit_price_paise=line.unit_price_paise,
                mrp_paise=line.product.mrp_paise,
                quantity=line.quantity,
                line_total_paise=line.line_total_paise,
            )
            for position, line in enumerate(result.lines)
        ]
        order.history = [
            OrderStatusHistory(
                from_status=None, to_status=OrderStatus.PENDING, actor_user_id=user.id
            )
        ]
        self.db.add(order)
        self.db.flush()  # the order id is needed by the stock movements

        inventory = InventoryService(self.db)
        for line in result.lines:
            inventory.take_for_order(
                line.product.id, quantity=line.quantity, order_id=order.id, actor_id=user.id
            )

        # The ordered products leave the cart; anything else the customer had stays.
        self.db.execute(
            delete(CartItem).where(
                CartItem.cart_id.in_(select(Cart.id).where(Cart.user_id == user.id)),
                CartItem.product_id.in_(ids),
            )
        )
        address.last_used_at = now
        self.db.commit()
        return order

    def _by_key(self, user: User, key: uuid.UUID) -> Order | None:
        return self.db.scalar(
            select(Order)
            .options(*with_details())
            .where(Order.user_id == user.id, Order.idempotency_key == key)
        )

    # --- reading ----------------------------------------------------------------------------

    def get(self, user: User, order_id: uuid.UUID) -> Order:
        order = self.db.scalar(
            select(Order)
            .options(*with_details())
            .where(Order.id == order_id, Order.user_id == user.id)
            .execution_options(populate_existing=True)
        )
        if order is None:
            raise AppError("NOT_FOUND", "Order not found.", 404)
        return order

    def page(self, user: User, scope: Scope, *, limit: int, offset: int) -> tuple[list[Order], int]:
        finished = Order.status.in_(TERMINAL_STATUSES)
        condition = finished if scope == "past" else ~finished
        base = select(Order).where(Order.user_id == user.id, condition)
        total = self.db.scalar(select(func.count()).select_from(base.subquery())) or 0
        orders = self.db.scalars(
            base.options(selectinload(Order.items))
            .order_by(Order.placed_at.desc(), Order.order_number.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return list(orders), total

    # --- cancelling -------------------------------------------------------------------------

    def cancel(self, user: User, order_id: uuid.UUID, reason: str | None) -> Order:
        order = self.db.scalar(
            select(Order)
            .options(*with_details())
            .where(Order.id == order_id, Order.user_id == user.id)
            .with_for_update(of=Order)
        )
        if order is None:
            raise AppError("NOT_FOUND", "Order not found.", 404)
        OrderStateMachine(self.db).transition(
            order, OrderStatus.CANCELLED, Actor(ActorKind.CUSTOMER, user.id), reason
        )
        self.db.commit()
        return self.get(user, order_id)


def _unavailable(product_id: uuid.UUID) -> AppError:
    return AppError(
        "PRODUCT_UNAVAILABLE",
        "An item in your order isn't available any more.",
        409,
        {"product_id": str(product_id)},
    )


def _raise_for_issue(product: Product, asked: int, issue: str | None, available: int) -> None:
    if issue is None:
        return
    if issue == "UNAVAILABLE":
        raise _unavailable(product.id)
    if product.max_per_order and asked > product.max_per_order and available > 0:
        raise AppError(
            "MAX_PER_ORDER",
            f"You can buy at most {product.max_per_order} of {product.name}.",
            409,
            {"product_id": str(product.id), "max": product.max_per_order},
        )
    raise AppError(
        "OUT_OF_STOCK",
        f"{product.name} is out of stock."
        if available == 0
        else f"{product.name} has only {available} left.",
        409,
        {"product_id": str(product.id), "available": available},
    )
