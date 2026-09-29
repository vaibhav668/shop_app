import uuid

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError
from app.models import Cart, CartItem, Product, User
from app.repositories.catalog import customer_visible_products
from app.services.pricing import Quote, quote
from app.services.shop import get_shop_settings


class CartService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def view(self, user: User) -> Quote:
        items = self.db.scalars(
            select(CartItem)
            .join(Cart)
            .options(joinedload(CartItem.product).joinedload(Product.category))
            .where(Cart.user_id == user.id)
            .order_by(CartItem.created_at)
        ).all()
        return quote([(item.product, item.quantity) for item in items], get_shop_settings(self.db))

    def set_quantity(self, user: User, product_id: uuid.UUID, quantity: int) -> Quote:
        cart_id = self._cart_id(user)
        current = self.db.scalar(
            select(CartItem.quantity).where(
                CartItem.cart_id == cart_id, CartItem.product_id == product_id
            )
        )

        if quantity == 0:
            self.db.execute(
                delete(CartItem).where(
                    CartItem.cart_id == cart_id, CartItem.product_id == product_id
                )
            )
            self.db.commit()
            return self.view(user)

        product = self.db.scalar(customer_visible_products().where(Product.id == product_id))
        if product is None:
            raise AppError("PRODUCT_UNAVAILABLE", "This product isn't available right now.", 409)

        # Lowering a quantity is always allowed; only increases are checked against stock.
        if quantity > (current or 0):
            if product.max_per_order and quantity > product.max_per_order:
                raise AppError(
                    "MAX_PER_ORDER",
                    f"You can buy at most {product.max_per_order} of this item.",
                    409,
                    {"product_id": str(product.id), "max": product.max_per_order},
                )
            if quantity > product.stock_quantity:
                message = (
                    "This item is out of stock."
                    if product.stock_quantity == 0
                    else f"Only {product.stock_quantity} left."
                )
                raise AppError(
                    "OUT_OF_STOCK",
                    message,
                    409,
                    {"product_id": str(product.id), "available": product.stock_quantity},
                )

        # Upsert keeps concurrent taps from different devices from colliding.
        self.db.execute(
            insert(CartItem)
            .values(id=uuid.uuid4(), cart_id=cart_id, product_id=product_id, quantity=quantity)
            .on_conflict_do_update(
                constraint="uq_cart_items_cart_product", set_={"quantity": quantity}
            )
        )
        self.db.commit()
        return self.view(user)

    def clear(self, user: User) -> Quote:
        self.db.execute(
            delete(CartItem).where(
                CartItem.cart_id.in_(select(Cart.id).where(Cart.user_id == user.id))
            )
        )
        self.db.commit()
        return self.view(user)

    def _cart_id(self, user: User) -> uuid.UUID:
        self.db.execute(
            insert(Cart)
            .values(id=uuid.uuid4(), user_id=user.id)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )
        return self.db.scalar(select(Cart.id).where(Cart.user_id == user.id))
