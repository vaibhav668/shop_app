"""Customer notifications: a row in the app's list plus a push to their phones.

The row is written in the caller's transaction, so it exists only if the order change commits.
The push is sent afterwards, from a background task that re-reads the row in a fresh session:
if the transaction rolled back there is no row, and nothing is sent. A failed push never
affects an order."""

import logging
import uuid
from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.integrations.push import PushMessage, PushProvider
from app.models import DeviceToken, Notification, Order, OrderStatus, PaymentMethod
from app.utils.money import format_rupees

logger = logging.getLogger(__name__)

ORDER_STATUS = "ORDER_STATUS"
SessionFactory = Callable[[], AbstractContextManager[Session]]


def order_message(order: Order, status: OrderStatus) -> tuple[str, str] | None:
    """(title, body) for an order reaching `status`, or None when there is nothing to say."""
    n = f"#{order.order_number}"
    cash = (
        f" Please keep {format_rupees(order.total_paise)} ready."
        if order.payment_method is PaymentMethod.COD
        else ""
    )
    messages = {
        OrderStatus.PENDING: (
            "Order placed",
            f"We've got order {n}. The shop will confirm it soon.",
        ),
        OrderStatus.CONFIRMED: ("Order confirmed", f"The shop has accepted order {n}."),
        OrderStatus.PREPARING: ("Packing your order", f"Order {n} is being packed."),
        OrderStatus.OUT_FOR_DELIVERY: ("Out for delivery", f"Order {n} is on its way.{cash}"),
        OrderStatus.DELIVERED: (
            "Delivered",
            f"Order {n} has been delivered. Thank you for shopping with us!",
        ),
        OrderStatus.CANCELLED: (
            "Order cancelled",
            f"Order {n} was cancelled"
            + (f": {order.cancel_reason}" if order.cancel_reason else "."),
        ),
    }
    return messages.get(status)


class Notifier:
    """One per request. `notify` records the notification now and queues its push."""

    def __init__(
        self,
        db: Session,
        background: BackgroundTasks | None,
        delivery: "PushDelivery | None",
    ) -> None:
        self.db = db
        self.background = background
        self.delivery = delivery

    def notify(
        self, user_id: uuid.UUID, type_: str, title: str, body: str, data: dict[str, Any]
    ) -> Notification:
        notification = Notification(user_id=user_id, type=type_, title=title, body=body, data=data)
        self.db.add(notification)
        self.db.flush()  # the id is what the background task looks up
        if self.background is not None and self.delivery is not None:
            self.background.add_task(self.delivery.deliver, notification.id)
        return notification

    def order_status(self, order: Order, status: OrderStatus) -> None:
        message = order_message(order, status)
        if message is None:
            return
        title, body = message
        self.notify(
            order.user_id,
            ORDER_STATUS,
            title,
            body,
            {"order_id": str(order.id), "status": status.value, "route": f"/orders/{order.id}"},
        )


class PushDelivery:
    """Runs after the response: sends one notification's push and forgets dead tokens."""

    def __init__(self, session_factory: SessionFactory, push: PushProvider) -> None:
        self.session_factory = session_factory
        self.push = push

    def deliver(self, notification_id: uuid.UUID) -> None:
        try:
            with self.session_factory() as db:
                notification = db.get(Notification, notification_id)
                if notification is None:
                    return  # the change that created it was rolled back
                tokens = list(
                    db.scalars(
                        select(DeviceToken.token).where(DeviceToken.user_id == notification.user_id)
                    )
                )
                if not tokens:
                    return
                data = {k: str(v) for k, v in notification.data.items()}
                result = self.push.send(
                    tokens, PushMessage(title=notification.title, body=notification.body, data=data)
                )
                if result.invalid_tokens:
                    db.execute(
                        delete(DeviceToken).where(DeviceToken.token.in_(result.invalid_tokens))
                    )
                    db.commit()
        except Exception:
            # Never let a push problem surface anywhere else; the in-app list still has it.
            logger.exception("Push delivery failed for notification %s", notification_id)


# --- the customer's list ------------------------------------------------------------------


def notifications_page(
    db: Session, user_id: uuid.UUID, *, limit: int, offset: int
) -> tuple[list[Notification], int]:
    total = db.scalar(select(func.count()).where(Notification.user_id == user_id)) or 0
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count()).where(
                Notification.user_id == user_id, Notification.read_at.is_(None)
            )
        )
        or 0
    )


def mark_all_read(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()
