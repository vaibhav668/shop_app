"""The shop's side of orders: the order list, status changes and the dashboard numbers."""

import uuid
from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models import (
    TERMINAL_STATUSES,
    Category,
    Order,
    OrderStatus,
    PaymentStatus,
    Product,
    User,
)
from app.schemas.order import (
    AdminOrderDetailOut,
    AdminOrderRow,
    CustomerOut,
    DashboardOut,
    HistoryEntry,
    LowStockItem,
    OrdersSummaryOut,
)
from app.services.notifications import Notifier
from app.services.order_state import Actor, ActorKind, OrderStateMachine, allowed_for
from app.services.orders import OrderViews, with_details
from app.services.shop import get_shop_settings


class AdminOrderService:
    def __init__(
        self,
        db: Session,
        views: OrderViews,
        shop_timezone: str,
        notifier: Notifier | None = None,
    ) -> None:
        self.db = db
        self.views = views
        self.tz = ZoneInfo(shop_timezone)
        self.notifier = notifier

    # --- list -------------------------------------------------------------------------------

    def page(
        self,
        *,
        status: OrderStatus | None,
        payment_status: PaymentStatus | None,
        q: str | None,
        date_from: date | None,
        date_to: date | None,
        limit: int,
        offset: int,
    ) -> tuple[list[AdminOrderRow], int]:
        stmt = select(Order).join(Order.user)
        if status is not None:
            stmt = stmt.where(Order.status == status)
        else:
            # Unpaid online orders aren't real orders yet; they show only when asked for.
            stmt = stmt.where(Order.status != OrderStatus.AWAITING_PAYMENT)
        if payment_status is not None:
            stmt = stmt.where(Order.payment_status == payment_status)
        if date_from is not None:
            stmt = stmt.where(Order.placed_at >= self._day_start(date_from))
        if date_to is not None:
            stmt = stmt.where(Order.placed_at < self._day_start(date_to + timedelta(days=1)))
        if q and q.strip():
            stmt = stmt.where(_search(q.strip()))

        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        orders = self.db.scalars(
            stmt.options(selectinload(Order.items), selectinload(Order.user))
            .order_by(Order.placed_at.desc(), Order.order_number.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return [self.row(o) for o in orders], total

    def row(self, order: Order) -> AdminOrderRow:
        area = ", ".join(filter(None, [order.delivery_line2, order.delivery_pincode]))
        return AdminOrderRow(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            payment_method=order.payment_method,
            payment_status=order.payment_status,
            total_paise=order.total_paise,
            item_count=sum(i.quantity for i in order.items),
            placed_at=order.placed_at,
            customer_name=order.delivery_name,
            customer_phone=order.delivery_phone,
            delivery_area=area,
        )

    # --- detail and status ------------------------------------------------------------------

    def get(self, order_id: uuid.UUID, *, lock: bool = False) -> Order:
        stmt = (
            select(Order)
            .options(*with_details(), selectinload(Order.user))
            .where(Order.id == order_id)
            .execution_options(populate_existing=True)
        )
        if lock:
            stmt = stmt.with_for_update(of=Order)
        order = self.db.scalar(stmt)
        if order is None:
            raise AppError("NOT_FOUND", "Order not found.", 404)
        return order

    def detail(self, order: Order) -> AdminOrderDetailOut:
        return AdminOrderDetailOut(
            **self.views.detail_fields(order),
            customer=CustomerOut(
                id=order.user.id,
                name=order.user.name,
                email=order.user.email,
                phone=order.user.phone,
            ),
            history=[
                HistoryEntry(
                    from_status=h.from_status,
                    to_status=h.to_status,
                    at=h.created_at,
                    actor=_actor_kind(order, h.actor_user_id),
                    actor_name=h.actor.name if h.actor else None,
                    note=h.note,
                )
                for h in order.history
            ],
            next_statuses=sorted(
                allowed_for(ActorKind.ADMIN, order.status), key=list(OrderStatus).index
            ),
        )

    def change_status(
        self, order_id: uuid.UUID, to: OrderStatus, admin: User, note: str | None
    ) -> Order:
        order = self.get(order_id, lock=True)
        OrderStateMachine(self.db, self.notifier).transition(
            order, to, Actor(ActorKind.ADMIN, admin.id), note
        )
        self.db.commit()
        return self.get(order_id)

    # --- polling and dashboard --------------------------------------------------------------

    def summary(self) -> OrdersSummaryOut:
        pending = self.db.scalar(select(func.count()).where(Order.status == OrderStatus.PENDING))
        latest = self.db.scalar(
            select(func.max(Order.placed_at)).where(Order.status != OrderStatus.AWAITING_PAYMENT)
        )
        return OrdersSummaryOut(pending_count=pending or 0, latest_order_at=latest)

    def dashboard(self, now: datetime) -> DashboardOut:
        today = self._day_start(now.astimezone(self.tz).date())
        placed_today = and_(Order.placed_at >= today, Order.status != OrderStatus.AWAITING_PAYMENT)
        today_orders = self.db.scalar(select(func.count()).where(placed_today)) or 0
        # Money actually in hand: paid online, or COD that was delivered (marked PAID then).
        revenue = self.db.scalar(
            select(func.coalesce(func.sum(Order.total_paise), 0)).where(
                placed_today, Order.payment_status == PaymentStatus.PAID
            )
        )
        counts = dict(
            self.db.execute(
                select(Order.status, func.count())
                .where(
                    Order.status.not_in(TERMINAL_STATUSES),
                    Order.status != OrderStatus.AWAITING_PAYMENT,
                )
                .group_by(Order.status)
            ).all()
        )
        recent = self.db.scalars(
            _real_orders()
            .options(selectinload(Order.items))
            .order_by(Order.placed_at.desc(), Order.order_number.desc())
            .limit(10)
        ).all()
        return DashboardOut(
            today_orders=today_orders,
            today_revenue_paise=int(revenue or 0),
            status_counts={s.value: counts.get(s, 0) for s in _IN_PROGRESS},
            low_stock=self._low_stock(),
            recent_orders=[self.row(o) for o in recent],
        )

    def _low_stock(self) -> list[LowStockItem]:
        default = get_shop_settings(self.db).default_low_stock_threshold
        threshold = func.coalesce(Product.low_stock_threshold, default)
        rows = self.db.execute(
            select(Product, threshold)
            .join(Product.category)
            .where(
                Product.is_active,
                Product.archived_at.is_(None),
                Category.is_active,
                Product.stock_quantity <= threshold,
            )
            .order_by(Product.stock_quantity, Product.name)
            .limit(10)
        ).all()
        return [
            LowStockItem(
                id=p.id,
                name=p.name,
                unit_label=p.unit_label,
                stock_quantity=p.stock_quantity,
                threshold=t,
            )
            for p, t in rows
        ]

    def _day_start(self, day: date) -> datetime:
        """Midnight in the shop's timezone, so "today" matches the shopkeeper's day."""
        return datetime.combine(day, time.min, tzinfo=self.tz)


_IN_PROGRESS = (
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.OUT_FOR_DELIVERY,
)


def _real_orders() -> Select[tuple[Order]]:
    return select(Order).where(Order.status != OrderStatus.AWAITING_PAYMENT)


def _search(q: str):
    """Order number ("10042" or "#10042"), customer name or phone."""
    digits = q.lstrip("#").strip()
    conditions = [
        Order.delivery_name.ilike(f"%{q}%"),
        User.name.ilike(f"%{q}%"),
    ]
    if digits.isdigit():
        conditions.append(Order.delivery_phone.contains(digits))
        conditions.append(User.phone.contains(digits))
        if len(digits) <= 12:
            conditions.append(Order.order_number == int(digits))
    return or_(*conditions)


def _actor_kind(order: Order, actor_id: uuid.UUID | None) -> Literal["CUSTOMER", "ADMIN", "SYSTEM"]:
    if actor_id is None:
        return "SYSTEM"
    if actor_id == order.user_id:
        return "CUSTOMER"
    return "ADMIN"
