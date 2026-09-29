import uuid
from typing import Literal

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Category, Product

CustomerSort = Literal["default", "price_asc", "price_desc"]


def customer_visible_products() -> Select[tuple[Product]]:
    """Products a customer may see: active, not archived, in an active category."""
    return (
        select(Product)
        .join(Product.category)
        .options(joinedload(Product.category))
        .where(Product.is_active, Product.archived_at.is_(None), Category.is_active)
    )


def list_active_categories(db: Session) -> list[Category]:
    return list(
        db.scalars(
            select(Category).where(Category.is_active).order_by(Category.sort_order, Category.name)
        )
    )


def get_active_category_by_slug(db: Session, slug: str) -> Category | None:
    return db.scalar(select(Category).where(Category.slug == slug, Category.is_active))


def list_customer_products(
    db: Session,
    *,
    category_id: uuid.UUID | None,
    in_stock_only: bool,
    sort: CustomerSort,
    limit: int,
    offset: int,
) -> tuple[list[Product], int]:
    stmt = customer_visible_products()
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if in_stock_only:
        stmt = stmt.where(Product.stock_quantity > 0)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    # Out-of-stock items sink to the bottom so the first screen is always shoppable.
    in_stock_first = case((Product.stock_quantity > 0, 0), else_=1)
    order = {
        "default": (in_stock_first, Product.sort_order, Product.name),
        "price_asc": (in_stock_first, Product.price_paise, Product.name),
        "price_desc": (in_stock_first, Product.price_paise.desc(), Product.name),
    }[sort]
    items = db.scalars(stmt.order_by(*order, Product.id).limit(limit).offset(offset)).unique()
    return list(items), total


def get_customer_product(db: Session, product_id: uuid.UUID) -> Product | None:
    return db.scalar(customer_visible_products().where(Product.id == product_id))


def list_related(db: Session, product: Product, limit: int = 10) -> list[Product]:
    in_stock_first = case((Product.stock_quantity > 0, 0), else_=1)
    stmt = (
        customer_visible_products()
        .where(Product.category_id == product.category_id, Product.id != product.id)
        .order_by(in_stock_first, Product.sort_order, Product.name)
        .limit(limit)
    )
    return list(db.scalars(stmt).unique())
