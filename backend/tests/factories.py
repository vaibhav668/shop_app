import itertools
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Address, Category, Product, User

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
    if "price_paise" in overrides and "mrp_paise" not in overrides:
        fields["mrp_paise"] = max(fields["mrp_paise"], overrides["price_paise"])
    product = Product(**(fields | overrides))
    db.add(product)
    db.flush()
    return product


def make_user(db: Session, **overrides: Any) -> User:
    n = next(_seq)
    fields: dict[str, Any] = {
        "google_sub": f"google-{n}-{uuid.uuid4().hex[:8]}",
        "email": f"user{n}-{uuid.uuid4().hex[:8]}@example.com",
        "name": f"Customer {n}",
        "phone": "9876543210",
    }
    user = User(**(fields | overrides))
    db.add(user)
    db.flush()
    return user


def make_address(db: Session, user: User, **overrides: Any) -> Address:
    fields: dict[str, Any] = {
        "user_id": user.id,
        "label": "Home",
        "recipient_name": user.name,
        "phone": "9876543210",
        "line1": "Flat 12, Shanti Apartments",
        "line2": "Rajpur Road",
        "city": "Dehradun",
        "state": "Uttarakhand",
        "pincode": "248001",
        "is_default": True,
    }
    address = Address(**(fields | overrides))
    db.add(address)
    db.flush()
    return address
