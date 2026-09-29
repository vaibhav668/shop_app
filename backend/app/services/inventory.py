"""The only code allowed to change products.stock_quantity. Every change is a single atomic
UPDATE (no read-modify-write races) and writes an inventory_movements row."""

import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import InventoryMovement, InventoryReason, Product


class InventoryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record_initial(self, product: Product, actor_id: uuid.UUID | None) -> None:
        if product.stock_quantity > 0:
            self._log(
                product.id,
                product.stock_quantity,
                product.stock_quantity,
                InventoryReason.INITIAL,
                actor_id,
                None,
            )

    def set_stock(
        self, product_id: uuid.UUID, *, new_stock: int, expected: int, actor_id: uuid.UUID | None
    ) -> int:
        """Sets an absolute count, but only if nobody changed it since the admin looked."""
        result = self.db.execute(
            update(Product)
            .where(Product.id == product_id, Product.stock_quantity == expected)
            .values(stock_quantity=new_stock)
            .returning(Product.stock_quantity)
        ).scalar_one_or_none()
        if result is None:
            current = self._current(product_id)
            raise AppError(
                "STOCK_CONFLICT",
                f"Stock changed to {current} while you were editing.",
                409,
                {"product_id": str(product_id), "expected": expected, "current": current},
            )
        if new_stock != expected:
            self._log(
                product_id,
                new_stock - expected,
                new_stock,
                InventoryReason.STOCK_SET,
                actor_id,
                None,
            )
        return result

    def adjust(
        self, product_id: uuid.UUID, *, delta: int, actor_id: uuid.UUID | None, note: str | None
    ) -> int:
        result = self.db.execute(
            update(Product)
            .where(Product.id == product_id, Product.stock_quantity + delta >= 0)
            .values(stock_quantity=Product.stock_quantity + delta)
            .returning(Product.stock_quantity)
        ).scalar_one_or_none()
        if result is None:
            current = self._current(product_id)
            raise AppError(
                "STOCK_WOULD_GO_NEGATIVE",
                f"Only {current} in stock; can't remove {-delta}.",
                409,
                {"product_id": str(product_id), "current": current},
            )
        self._log(product_id, delta, result, InventoryReason.MANUAL_ADJUST, actor_id, note)
        return result

    def take_for_order(
        self, product_id: uuid.UUID, *, quantity: int, order_id: uuid.UUID, actor_id: uuid.UUID
    ) -> int:
        """Reserves stock for a new order. The caller holds the product row lock and has already
        checked availability; the WHERE clause (and the CHECK constraint) are the safety net."""
        result = self.db.execute(
            update(Product)
            .where(Product.id == product_id, Product.stock_quantity >= quantity)
            .values(stock_quantity=Product.stock_quantity - quantity)
            .returning(Product.stock_quantity)
        ).scalar_one_or_none()
        if result is None:
            current = self._current(product_id)
            raise AppError(
                "OUT_OF_STOCK",
                f"Only {current} left." if current else "This item is out of stock.",
                409,
                {"product_id": str(product_id), "available": current},
            )
        self._log(
            product_id, -quantity, result, InventoryReason.ORDER_PLACED, actor_id, None, order_id
        )
        return result

    def return_for_order(
        self,
        product_id: uuid.UUID,
        *,
        quantity: int,
        order_id: uuid.UUID,
        actor_id: uuid.UUID | None,
    ) -> int:
        """Puts a cancelled order's units back on the shelf."""
        result = self.db.execute(
            update(Product)
            .where(Product.id == product_id)
            .values(stock_quantity=Product.stock_quantity + quantity)
            .returning(Product.stock_quantity)
        ).scalar_one()
        self._log(
            product_id, quantity, result, InventoryReason.ORDER_CANCELLED, actor_id, None, order_id
        )
        return result

    def _current(self, product_id: uuid.UUID) -> int:
        current = self.db.scalar(select(Product.stock_quantity).where(Product.id == product_id))
        if current is None:
            raise AppError("NOT_FOUND", "Product not found.", 404)
        return current

    def _log(
        self,
        product_id: uuid.UUID,
        delta: int,
        resulting: int,
        reason: InventoryReason,
        actor_id: uuid.UUID | None,
        note: str | None,
        order_id: uuid.UUID | None = None,
    ) -> None:
        self.db.add(
            InventoryMovement(
                product_id=product_id,
                delta=delta,
                resulting_stock=resulting,
                reason=reason,
                actor_user_id=actor_id,
                note=note,
                order_id=order_id,
            )
        )
