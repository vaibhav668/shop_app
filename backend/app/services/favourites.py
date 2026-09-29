import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Favourite, Product, User
from app.repositories.catalog import customer_visible_products


class FavouritesService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def page(self, user: User, *, limit: int, offset: int) -> tuple[list[Product], int]:
        """Favourites that are still visible in the shop, newest first."""
        stmt = customer_visible_products().join(
            Favourite, (Favourite.product_id == Product.id) & (Favourite.user_id == user.id)
        )
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = self.db.scalars(
            stmt.order_by(Favourite.created_at.desc(), Product.id).limit(limit).offset(offset)
        ).unique()
        return list(items), total

    def ids(self, user: User) -> list[uuid.UUID]:
        return list(
            self.db.scalars(select(Favourite.product_id).where(Favourite.user_id == user.id))
        )

    def add(self, user: User, product_id: uuid.UUID) -> None:
        if self.db.scalar(customer_visible_products().where(Product.id == product_id)) is None:
            raise AppError("NOT_FOUND", "This product isn't available.", 404)
        self.db.execute(
            insert(Favourite)
            .values(user_id=user.id, product_id=product_id)
            .on_conflict_do_nothing()
        )
        self.db.commit()

    def remove(self, user: User, product_id: uuid.UUID) -> None:
        self.db.execute(
            delete(Favourite).where(
                Favourite.user_id == user.id, Favourite.product_id == product_id
            )
        )
        self.db.commit()
