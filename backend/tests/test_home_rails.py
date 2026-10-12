"""Home rails (deals, under ₹99, one per aisle) and the signed-in "Buy again" rail."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import make_category, make_product
from tests.test_addresses import ADDRESSES, address_body
from tests.test_orders import body, customer, place

API = "/api/v1"


def names(items: list[dict]) -> list[str]:
    return [p["name"] for p in items]


def test_home_rails(client: TestClient, db_session: Session) -> None:
    dairy = make_category(db_session, name="Dairy", slug="dairy")
    snacks = make_category(db_session, name="Snacks", slug="snacks")
    make_category(db_session, name="Empty aisle", slug="empty")
    make_product(db_session, dairy, name="Milk", price_paise=2800, mrp_paise=2800)
    make_product(db_session, dairy, name="Ghee", price_paise=50000, mrp_paise=60000)  # 16.7% off
    make_product(db_session, snacks, name="Chips", price_paise=3000, mrp_paise=4000)  # 25% off
    make_product(db_session, snacks, name="Bhujia", price_paise=5500, mrp_paise=6000)  # 8.3% off
    make_product(
        db_session, snacks, name="Sold out", price_paise=1000, mrp_paise=2000, stock_quantity=0
    )
    make_product(
        db_session, snacks, name="Hidden", price_paise=1000, mrp_paise=2000, is_active=False
    )
    db_session.commit()

    home = client.get(f"{API}/home").json()

    # Biggest share off first; nothing undiscounted, out of stock or hidden.
    assert names(home["deals"]) == ["Chips", "Ghee", "Bhujia"]
    # At or under ₹99, discounted first.
    assert home["under_price_paise"] == 9900
    assert names(home["under_price"]) == ["Chips", "Bhujia", "Milk"]
    # One rail per aisle with products; in-stock first; empty aisles skipped.
    rails = {r["category"]["slug"]: names(r["products"]) for r in home["rails"]}
    assert set(rails) == {"dairy", "snacks"}
    assert rails["snacks"][-1] == "Sold out"
    assert "Hidden" not in rails["snacks"]


def test_buy_again_needs_sign_in(client: TestClient) -> None:
    assert client.get(f"{API}/me/buy-again").status_code == 401


def test_buy_again_lists_what_the_customer_orders_most(
    client: TestClient, db_session: Session
) -> None:
    aisle = make_category(db_session)
    dal = make_product(db_session, aisle, name="Toor Dal", price_paise=12000, stock_quantity=50)
    rice = make_product(db_session, aisle, name="Rice", price_paise=12000, stock_quantity=50)
    make_product(db_session, aisle, name="Never ordered")
    db_session.commit()

    me = customer(client)
    assert client.get(f"{API}/me/buy-again", headers=me).json() == []

    address = client.post(ADDRESSES, json=address_body(), headers=me).json()["id"]
    assert place(client, me, body(address, (rice, 1), total=14000)).status_code in (200, 201)
    assert place(client, me, body(address, (dal, 1), total=14000)).status_code in (200, 201)
    assert place(client, me, body(address, (dal, 1), total=14000)).status_code in (200, 201)

    assert names(client.get(f"{API}/me/buy-again", headers=me).json()) == ["Toor Dal", "Rice"]

    # Someone else's orders don't count.
    other = customer(client, email="ravi@example.com")
    assert client.get(f"{API}/me/buy-again", headers=other).json() == []
