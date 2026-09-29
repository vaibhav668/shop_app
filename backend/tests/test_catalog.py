"""Customer-facing catalog: only shoppable things are visible, and prices come from the server."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import utcnow
from tests.factories import make_category, make_product

API = "/api/v1"


def test_categories_are_database_driven_and_hide_inactive(
    client: TestClient, db_session: Session
) -> None:
    make_category(db_session, name="Dairy", slug="dairy", sort_order=2)
    make_category(db_session, name="Bakery", slug="bakery", sort_order=1)
    make_category(db_session, name="Hidden", slug="hidden", is_active=False)

    names = [c["name"] for c in client.get(f"{API}/categories").json()]
    assert names == ["Bakery", "Dairy"]


def test_category_by_slug(client: TestClient, db_session: Session) -> None:
    make_category(db_session, name="Dairy", slug="dairy")
    assert client.get(f"{API}/categories/dairy").json()["name"] == "Dairy"
    assert client.get(f"{API}/categories/nope").status_code == 404


def test_product_list_hides_unshoppable_products(client: TestClient, db_session: Session) -> None:
    shown = make_category(db_session)
    hidden = make_category(db_session, is_active=False)
    visible = make_product(db_session, shown, name="Visible")
    make_product(db_session, shown, name="Disabled", is_active=False)
    make_product(db_session, shown, name="Archived", archived_at=utcnow())
    make_product(db_session, hidden, name="In hidden category")

    body = client.get(f"{API}/products").json()
    assert [p["name"] for p in body["items"]] == ["Visible"]
    assert body["total"] == 1
    assert body["items"][0]["id"] == str(visible.id)


def test_card_fields(client: TestClient, db_session: Session) -> None:
    category = make_category(db_session)
    make_product(db_session, category, price_paise=4500, mrp_paise=5000, stock_quantity=20)

    card = client.get(f"{API}/products").json()["items"][0]
    assert card["price_paise"] == 4500
    assert card["mrp_paise"] == 5000
    assert card["discount_percent"] == 10
    assert card["is_available"] is True
    assert card["stock_hint"] == "IN_STOCK"
    assert "stock_quantity" not in card  # customers never see exact stock


def test_stock_hints(client: TestClient, db_session: Session) -> None:
    category = make_category(db_session)
    make_product(db_session, category, name="A plenty", stock_quantity=50)
    make_product(db_session, category, name="B low (shop default 5)", stock_quantity=5)
    make_product(
        db_session, category, name="C low (own threshold)", stock_quantity=9, low_stock_threshold=10
    )
    make_product(db_session, category, name="D out", stock_quantity=0)

    hints = {p["name"][0]: p["stock_hint"] for p in client.get(f"{API}/products").json()["items"]}
    assert hints == {"A": "IN_STOCK", "B": "LOW", "C": "LOW", "D": "OUT"}


def test_out_of_stock_sinks_to_bottom(client: TestClient, db_session: Session) -> None:
    category = make_category(db_session)
    make_product(db_session, category, name="Out first by order", stock_quantity=0, sort_order=1)
    make_product(db_session, category, name="In stock", stock_quantity=3, sort_order=2)

    names = [p["name"] for p in client.get(f"{API}/products").json()["items"]]
    assert names == ["In stock", "Out first by order"]


def test_filter_sort_and_paginate(client: TestClient, db_session: Session) -> None:
    dairy = make_category(db_session)
    other = make_category(db_session)
    for price in (3000, 1000, 2000):
        make_product(db_session, dairy, price_paise=price, mrp_paise=price)
    make_product(db_session, other)
    make_product(db_session, dairy, name="Sold out", stock_quantity=0)

    url = f"{API}/products?category_id={dairy.id}&sort=price_asc&in_stock_only=true&limit=2"
    page = client.get(url).json()
    assert page["total"] == 3
    assert [p["price_paise"] for p in page["items"]] == [1000, 2000]

    page2 = client.get(f"{url}&offset=2").json()
    assert [p["price_paise"] for p in page2["items"]] == [3000]


def test_page_size_is_capped(client: TestClient) -> None:
    assert client.get(f"{API}/products?limit=500").status_code == 400


def test_product_detail_with_related(client: TestClient, db_session: Session) -> None:
    category = make_category(db_session, name="Dairy", slug="dairy")
    milk = make_product(db_session, category, name="Milk", description="Fresh toned milk")
    make_product(db_session, category, name="Curd")
    make_product(db_session, make_category(db_session), name="Elsewhere")

    detail = client.get(f"{API}/products/{milk.id}").json()
    assert detail["name"] == "Milk"
    assert detail["description"] == "Fresh toned milk"
    assert detail["category"] == {"id": str(category.id), "name": "Dairy", "slug": "dairy"}
    assert [r["name"] for r in detail["related"]] == ["Curd"]


def test_hidden_product_detail_is_not_found(client: TestClient, db_session: Session) -> None:
    product = make_product(db_session, make_category(db_session), is_active=False)
    assert client.get(f"{API}/products/{product.id}").status_code == 404


def test_shop_info(client: TestClient) -> None:
    shop = client.get(f"{API}/shop").json()
    assert shop["name"] == "Bada Bazar"
    assert shop["delivery_fee_paise"] == 2000
