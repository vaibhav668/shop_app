import uuid
from typing import Literal

from sqlalchemy import Select, case, func, literal_column, or_, select
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


# --- search ---------------------------------------------------------------------------------

# Must match the expression of the GIN trigram index in migration 0004 so Postgres can use it.
SEARCH_TEXT = func.lower(
    Product.name.op("||")(literal_column("' '")).op("||")(
        func.coalesce(Product.search_keywords, literal_column("''"))
    )
)
# word_similarity() ≥ this counts as a typo-tolerant match ("tomatoe" → "tomato").
FUZZY_THRESHOLD = 0.5
FUZZY_MIN_LENGTH = 3


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _normalise_query(q: str) -> str:
    return " ".join(q.lower().split())


def apply_search(
    stmt: Select[tuple[Product]], q: str, *, fuzzy: bool
) -> tuple[Select[tuple[Product]], tuple]:
    """Every word must match the name or local keywords ("doodh"): as a substring, or with
    `fuzzy`, as a close typo ("tomatoe"). Ranked: name starts with the query, then contains
    the whole query, then by closeness."""
    term = _normalise_query(q)
    for word in term.split():
        word_match = SEARCH_TEXT.like(f"%{_escape_like(word)}%", escape="\\")
        if fuzzy and len(word) >= FUZZY_MIN_LENGTH:
            word_match = or_(word_match, func.word_similarity(word, SEARCH_TEXT) >= FUZZY_THRESHOLD)
        stmt = stmt.where(word_match)

    rank = case(
        (func.lower(Product.name).like(f"{_escape_like(term)}%", escape="\\"), 0),
        (SEARCH_TEXT.like(f"%{_escape_like(term)}%", escape="\\"), 1),
        else_=2,
    )
    return stmt, (rank, func.word_similarity(term, SEARCH_TEXT).desc())


def _count(db: Session, stmt: Select[tuple[Product]]) -> int:
    return db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0


def _search(
    db: Session, base: Select[tuple[Product]], q: str
) -> tuple[Select[tuple[Product]], tuple, int]:
    """Exact (substring) matches first; only if there are none, fall back to typo-tolerant
    matching. Keeps short words precise ("chai" finds tea, not "chakki")."""
    stmt, relevance = apply_search(base, q, fuzzy=False)
    total = _count(db, stmt)
    if total == 0:
        stmt, relevance = apply_search(base, q, fuzzy=True)
        total = _count(db, stmt)
    return stmt, relevance, total


def list_customer_products(
    db: Session,
    *,
    category_id: uuid.UUID | None,
    in_stock_only: bool,
    sort: CustomerSort,
    limit: int,
    offset: int,
    q: str | None = None,
) -> tuple[list[Product], int]:
    stmt = customer_visible_products()
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if in_stock_only:
        stmt = stmt.where(Product.stock_quantity > 0)
    relevance: tuple = ()
    if q and q.strip():
        stmt, relevance, total = _search(db, stmt, q)
    else:
        total = _count(db, stmt)

    # Out-of-stock items sink to the bottom so the first screen is always shoppable.
    in_stock_first = case((Product.stock_quantity > 0, 0), else_=1)
    order = {
        "default": (in_stock_first, *relevance, Product.sort_order, Product.name),
        "price_asc": (in_stock_first, Product.price_paise, Product.name),
        "price_desc": (in_stock_first, Product.price_paise.desc(), Product.name),
    }[sort]
    items = db.scalars(stmt.order_by(*order, Product.id).limit(limit).offset(offset)).unique()
    return list(items), total


def suggest_products(db: Session, q: str, limit: int = 8) -> list[Product]:
    stmt, relevance, _ = _search(db, customer_visible_products(), q)
    in_stock_first = case((Product.stock_quantity > 0, 0), else_=1)
    return list(
        db.scalars(stmt.order_by(in_stock_first, *relevance, Product.name).limit(limit)).unique()
    )


def list_featured(db: Session, limit: int = 12) -> list[Product]:
    """Featured, in-stock products; falls back to the shop's own ordering if none are featured."""
    base = customer_visible_products().where(Product.stock_quantity > 0)
    featured = list(
        db.scalars(
            base.where(Product.is_featured).order_by(Product.sort_order, Product.name).limit(limit)
        ).unique()
    )
    if featured:
        return featured
    return list(
        db.scalars(
            base.order_by(Category.sort_order, Product.sort_order, Product.name).limit(limit)
        ).unique()
    )


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
