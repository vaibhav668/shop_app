import itertools
from typing import Any

from sqlalchemy.orm import Session

from app.models import Category, Product

_seq = itertools.count(1)


def make_category(db: Session, **overrides: Any) -> Category:
    n = next(_seq)
    fields: dict[str, Any] = {"name": f"Category {n}", "slug": f"category-{n}", "sort_order": n}
    category = Category(**(fields | overrides))
    db.add(category)
    db.flush()
    return category


def make_product(db: Session, category: Category, **overrides: Any) -> Product:
    n = next(_seq)
    fields: dict[str, Any] = {
        "category_id": category.id,
        "name": f"Product {n}",
        "slug": f"product-{n}",
        "unit_label": "500 g",
        "price_paise": 4500,
        "mrp_paise": 5000,
        "stock_quantity": 20,
        "sort_order": n,
    }
    product = Product(**(fields | overrides))
    db.add(product)
    db.flush()
    return product
