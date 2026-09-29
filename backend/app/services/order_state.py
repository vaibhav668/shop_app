"""The ONLY code that changes an order's status. Customer cancels, admin actions and (Phase 8)
payment events all come through here, so every change is checked, logged and has its effects."""

import enum
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import (
    TERMINAL_STATUSES,
    Order,
    OrderStatus,
    OrderStatusHistory,
    PaymentMethod,
    PaymentStatus,
)
from app.services.inventory import InventoryService

if TYPE_CHECKING:
    from app.services.notifications import Notifier

S = OrderStatus

# Every allowed edge. Anything not listed is refused.
TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    S.AWAITING_PAYMENT: frozenset({S.PENDING, S.CANCELLED}),
    S.PENDING: frozenset({S.CONFIRMED, S.CANCELLED}),
    S.CONFIRMED: frozenset({S.PREPARING, S.CANCELLED}),
    S.PREPARING: frozenset({S.OUT_FOR_DELIVERY, S.CANCELLED}),
    S.OUT_FOR_DELIVERY: frozenset({S.DELIVERED, S.CANCELLED}),
    S.DELIVERED: frozenset(),
    S.CANCELLED: frozenset(),
}


class ActorKind(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"  # payment verification and expiry (Phase 8)


@dataclass(frozen=True)
class Actor:
    kind: ActorKind
    user_id: uuid.UUID | None = None


# Customers may only cancel before the shop has accepted the order.
CUSTOMER_CANCELLABLE = frozenset({S.AWAITING_PAYMENT, S.PENDING})


def allowed_for(actor: ActorKind, current: OrderStatus) -> frozenset[OrderStatus]:
    """What this kind of actor may move the order to from `current`."""
    edges = TRANSITIONS[current]
    if actor is ActorKind.CUSTOMER:
        return frozenset({S.CANCELLED}) if current in CUSTOMER_CANCELLABLE else frozenset()
    if actor is ActorKind.ADMIN:
        # Moving out of AWAITING_PAYMENT to PENDING means "paid": only the payment flow may.
        return edges - {S.PENDING}
    return edges


class OrderStateMachine:
    def __init__(self, db: Session, notifier: "Notifier | None" = None) -> None:
        self.db = db
        self.notifier = notifier

    def transition(
        self, order: Order, to: OrderStatus, actor: Actor, note: str | None = None
    ) -> None:
        """The caller must hold the order row lock (SELECT ... FOR UPDATE) and commit after."""
        current = order.status
        if to not in allowed_for(actor.kind, current):
            raise AppError(
                "INVALID_STATUS_TRANSITION",
                _refusal(actor.kind, current, to),
                409,
                {"from": current.value, "to": to.value},
            )
        note = (note or "").strip() or None
        if to is S.CANCELLED and actor.kind is ActorKind.ADMIN and not note:
            raise AppError(
                "CANCEL_REASON_REQUIRED", "Tell the customer why the order was cancelled.", 400
            )

        order.status = to
        if to is S.CANCELLED:
            self._on_cancel(order, actor, note)
        if to is S.DELIVERED and order.payment_method is PaymentMethod.COD:
            order.payment_status = PaymentStatus.PAID  # cash collected at the door

        self.db.add(
            OrderStatusHistory(
                order_id=order.id,
                position=len(order.history),
                from_status=current,
                to_status=to,
                actor_user_id=actor.user_id,
                note=note,
            )
        )
        # Tell the customer, unless they made this change themselves (they just saw it).
        if self.notifier is not None and actor.kind is not ActorKind.CUSTOMER:
            self.notifier.order_status(order, to)

    def _on_cancel(self, order: Order, actor: Actor, note: str | None) -> None:
        order.cancel_reason = note
        order.cancelled_by = actor.user_id
        inventory = InventoryService(self.db)
        for item in order.items:
            inventory.return_for_order(
                item.product_id, quantity=item.quantity, order_id=order.id, actor_id=actor.user_id
            )
        # payment_status is left alone: nothing was collected for a cancelled COD order.
        # Phase 8 adds the refund for orders that were already paid online.


def _refusal(actor: ActorKind, current: OrderStatus, to: OrderStatus) -> str:
    if current in TERMINAL_STATUSES:
        return f"This order is already {current.value.lower()}."
    if actor is ActorKind.CUSTOMER and to is S.CANCELLED:
        return "The shop has already accepted this order. Please call the shop to cancel."
    return f"An order can't move from {current.value} to {to.value}."
