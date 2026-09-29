"""Read-side queries for the Inventory and Customers admin pages."""

import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models import (
    InventoryMovement,
    Order,
    OrderStatus,
    PaymentStatus,
    Product,
    User,
    UserRole,
)
from app.schemas.admin_inventory import CustomerDetailOut, CustomerRow, MovementOut
from app.services.admin_orders import AdminOrderService


def movements_page(
    db: Session, *, product_id: uuid.UUID | None, limit: int, offset: int
) -> tuple[list[MovementOut], int]:
    """Newest first. Every stock change ever made, with who made it and why."""
    base = select(InventoryMovement)
    if product_id is not None:
        base = base.where(InventoryMovement.product_id == product_id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    rows = db.execute(
        select(InventoryMovement, Product.name, Order.order_number, User.name)
        .join(Product, Product.id == InventoryMovement.product_id)
        .outerjoin(Order, Order.id == InventoryMovement.order_id)
        .outerjoin(User, User.id == InventoryMovement.actor_user_id)
        .where(*([InventoryMovement.product_id == product_id] if product_id else []))
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        MovementOut(
            id=m.id,
            product_id=m.product_id,
            product_name=product_name,
            delta=m.delta,
            resulting_stock=m.resulting_stock,
            reason=m.reason,
            order_id=m.order_id,
            order_number=order_number,
            actor_name=actor_name,
            note=m.note,
            created_at=m.created_at,
        )
        for m, product_name, order_number, actor_name in rows
    ], total


class CustomerService:
    def __init__(self, db: Session, orders: AdminOrderService) -> None:
        self.db = db
        self.orders = orders

    def _stats(self):
        """Per-customer order numbers, as a subquery to join onto users."""
        real = Order.status != OrderStatus.AWAITING_PAYMENT
        return (
            select(
                Order.user_id.label("user_id"),
                func.count().filter(real).label("order_count"),
                func.count().filter(Order.status == OrderStatus.CANCELLED).label("cancelled"),
                func.coalesce(
                    func.sum(case((Order.payment_status == PaymentStatus.PAID, Order.total_paise))),
                    0,
                ).label("spent"),
                func.max(Order.placed_at).filter(real).label("last_order_at"),
            )
            .group_by(Order.user_id)
            .subquery()
        )

    def page(self, *, q: str | None, limit: int, offset: int) -> tuple[list[CustomerRow], int]:
        stats = self._stats()
        stmt = (
            select(User, stats)
            .outerjoin(stats, stats.c.user_id == User.id)
            .where(User.role == UserRole.CUSTOMER, User.deleted_at.is_(None))
        )
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(User.name.ilike(term), User.email.ilike(term), User.phone.contains(q.strip()))
            )
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self.db.execute(
            # Most recent buyers first; people who never ordered after them, newest sign-up first.
            stmt.order_by(
                stats.c.last_order_at.desc().nulls_last(), User.created_at.desc(), User.id
            )
            .limit(limit)
            .offset(offset)
        ).all()
        return [self._row(r) for r in rows], total

    def detail(self, user_id: uuid.UUID) -> CustomerDetailOut:
        stats = self._stats()
        row = self.db.execute(
            select(User, stats)
            .outerjoin(stats, stats.c.user_id == User.id)
            .where(User.id == user_id, User.role == UserRole.CUSTOMER)
        ).one_or_none()
        if row is None:
            raise AppError("NOT_FOUND", "Customer not found.", 404)
        recent = self.db.scalars(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.user_id == user_id, Order.status != OrderStatus.AWAITING_PAYMENT)
            .order_by(Order.placed_at.desc(), Order.order_number.desc())
            .limit(20)
        ).all()
        return CustomerDetailOut(
            **self._row(row).model_dump(),
            cancelled_count=row.cancelled or 0,
            recent_orders=[self.orders.row(o) for o in recent],
        )

    @staticmethod
    def _row(row) -> CustomerRow:
        user: User = row[0]
        return CustomerRow(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            joined_at=user.created_at,
            order_count=row.order_count or 0,
            total_spent_paise=int(row.spent or 0),
            last_order_at=row.last_order_at,
        )
