"""Inventory tools (Quick Stock bulk save, +/- adjust, history) and the Customers pages."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InventoryMovement, InventoryReason, Product
from tests.factories import make_category, make_product
from tests.helpers import bearer, promote, sign_in
from tests.test_addresses import ADDRESSES, address_body
from tests.test_orders import body, customer

ADMIN = "/api/v1/admin"


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> dict[str, str]:
    sign_in(client, email="owner@example.com")
    promote(db_session, "owner@example.com")
    return bearer(sign_in(client, email="owner@example.com")["access_token"])


@pytest.fixture
def products(db_session: Session) -> list[Product]:
    category = make_category(db_session)
    made = [
        make_product(db_session, category, name=name, stock_quantity=stock)
        for name, stock in (("Milk", 10), ("Bread", 4), ("Eggs", 30))
    ]
    db_session.commit()
    return made


def movements(db: Session, product: Product) -> list[tuple[InventoryReason, int, int]]:
    return [
        (m.reason, m.delta, m.resulting_stock)
        for m in db.scalars(
            select(InventoryMovement)
            .where(InventoryMovement.product_id == product.id)
            .order_by(InventoryMovement.created_at, InventoryMovement.resulting_stock)
        )
    ]


def bulk(client: TestClient, admin: dict[str, str], rows: list[dict[str, Any]]) -> Any:
    return client.post(f"{ADMIN}/inventory/bulk", json={"updates": rows}, headers=admin)


class TestBulkStock:
    def test_applies_matching_rows_and_reports_conflicts(
        self,
        client: TestClient,
        admin: dict[str, str],
        products: list[Product],
        db_session: Session,
    ) -> None:
        milk, bread, eggs = products
        # An order took 2 bread after the admin loaded the page (they still think it's 6).
        response = bulk(
            client,
            admin,
            [
                {"product_id": str(milk.id), "stock": 24, "expected_stock": 10},
                {"product_id": str(bread.id), "stock": 12, "expected_stock": 6},
                {"product_id": str(eggs.id), "stock": 30, "expected_stock": 30},
            ],
        )
        result = response.json()
        assert response.status_code == 200
        assert sorted((a["product_id"], a["stock_quantity"]) for a in result["applied"]) == sorted(
            [(str(milk.id), 24), (str(eggs.id), 30)]
        )
        assert result["conflicts"] == [{"product_id": str(bread.id), "expected": 6, "current": 4}]

        for p in products:
            db_session.refresh(p)
        assert (milk.stock_quantity, bread.stock_quantity, eggs.stock_quantity) == (24, 4, 30)
        # One movement per real change: milk moved, bread conflicted, eggs unchanged.
        assert movements(db_session, milk) == [(InventoryReason.STOCK_SET, 14, 24)]
        assert movements(db_session, bread) == []
        assert movements(db_session, eggs) == []

    @pytest.mark.parametrize(
        "row",
        [
            {"stock": -1, "expected_stock": 10},
            {"stock": 100_001, "expected_stock": 10},
            {"stock": 5, "expected_stock": -1},
        ],
    )
    def test_rejects_bad_values(
        self,
        client: TestClient,
        admin: dict[str, str],
        products: list[Product],
        row: dict[str, int],
    ) -> None:
        response = bulk(client, admin, [{"product_id": str(products[0].id)} | row])
        assert response.status_code == 400

    def test_rejects_duplicates_and_unknown_products(
        self,
        client: TestClient,
        admin: dict[str, str],
        products: list[Product],
        db_session: Session,
    ) -> None:
        milk = products[0]
        row = {"product_id": str(milk.id), "stock": 5, "expected_stock": 10}
        assert bulk(client, admin, [row, row]).status_code == 400

        unknown = {"product_id": str(uuid.uuid4()), "stock": 5, "expected_stock": 1}
        response = bulk(client, admin, [row, unknown])
        assert response.status_code == 404
        db_session.refresh(milk)
        assert milk.stock_quantity == 10  # nothing applied when the request is invalid

    def test_customers_cannot_use_it(self, client: TestClient, products: list[Product]) -> None:
        shopper = bearer(sign_in(client)["access_token"])
        row = {"product_id": str(products[0].id), "stock": 1, "expected_stock": 10}
        assert bulk(client, shopper, [row]).status_code == 403


class TestAdjustAndHistory:
    def test_adjust_logs_every_change_and_refuses_negative(
        self,
        client: TestClient,
        admin: dict[str, str],
        products: list[Product],
        db_session: Session,
    ) -> None:
        bread = products[1]
        url = f"{ADMIN}/products/{bread.id}/stock-adjust"
        assert (
            client.post(url, json={"delta": 6, "note": "Morning delivery"}, headers=admin).json()[
                "stock_quantity"
            ]
            == 10
        )
        assert client.post(url, json={"delta": -3}, headers=admin).json()["stock_quantity"] == 7

        response = client.post(url, json={"delta": -8}, headers=admin)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "STOCK_WOULD_GO_NEGATIVE"
        db_session.refresh(bread)
        assert bread.stock_quantity == 7
        assert movements(db_session, bread) == [
            (InventoryReason.MANUAL_ADJUST, 6, 10),
            (InventoryReason.MANUAL_ADJUST, -3, 7),
        ]

    def test_history_shows_orders_admins_and_notes(
        self,
        client: TestClient,
        admin: dict[str, str],
        products: list[Product],
    ) -> None:
        bread = products[1]
        client.post(
            f"{ADMIN}/products/{bread.id}/stock-adjust",
            json={"delta": 6, "note": "Morning delivery"},
            headers=admin,
        )
        shopper = customer(client)
        address_id = client.post(ADDRESSES, json=address_body(), headers=shopper).json()["id"]
        # Bread costs ₹45: 3 of them is ₹135, plus ₹20 delivery.
        order = client.post(
            "/api/v1/orders", json=body(address_id, (bread, 3), total=15500), headers=shopper
        ).json()["order"]

        page = client.get(
            f"{ADMIN}/inventory/movements?product_id={bread.id}", headers=admin
        ).json()
        assert page["total"] == 2
        latest, first = page["items"]
        assert (latest["reason"], latest["delta"], latest["resulting_stock"]) == (
            "ORDER_PLACED",
            -3,
            7,
        )
        assert latest["order_number"] == order["order_number"]
        assert latest["actor_name"] == "Asha"
        assert (first["reason"], first["note"], first["actor_name"]) == (
            "MANUAL_ADJUST",
            "Morning delivery",
            "Owner",
        )
        assert first["product_name"] == "Bread"

    def test_history_for_all_products(
        self, client: TestClient, admin: dict[str, str], products: list[Product]
    ) -> None:
        for p in products:
            client.post(f"{ADMIN}/products/{p.id}/stock-adjust", json={"delta": 1}, headers=admin)
        page = client.get(f"{ADMIN}/inventory/movements?limit=2", headers=admin).json()
        assert page["total"] == 3 and len(page["items"]) == 2


class TestCustomers:
    def test_list_with_order_stats(
        self, client: TestClient, admin: dict[str, str], products: list[Product]
    ) -> None:
        milk = products[0]
        shopper = customer(client)
        customer(client, "ravi@example.com")  # signed up, never ordered
        address_id = client.post(ADDRESSES, json=address_body(), headers=shopper).json()["id"]
        # Milk costs ₹45: 3 of them is ₹135, plus ₹20 delivery.
        delivered = client.post(
            "/api/v1/orders", json=body(address_id, (milk, 3), total=15500), headers=shopper
        ).json()["order"]
        cancelled = client.post(
            "/api/v1/orders", json=body(address_id, (milk, 3), total=15500), headers=shopper
        ).json()["order"]
        for step in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"):
            client.patch(
                f"{ADMIN}/orders/{delivered['id']}/status",
                json={"to_status": step},
                headers=admin,
            )
        client.post(f"/api/v1/orders/{cancelled['id']}/cancel", json={}, headers=shopper)

        page = client.get(f"{ADMIN}/customers", headers=admin).json()
        names = [c["name"] for c in page["items"]]
        assert names[0] == "Asha"  # ordered most recently; the admin isn't listed
        assert "Owner" not in names and "Ravi" in names
        asha = page["items"][0]
        assert asha["order_count"] == 2
        assert asha["total_spent_paise"] == 15500  # only the delivered, paid one
        assert asha["last_order_at"] is not None
        ravi = next(c for c in page["items"] if c["name"] == "Ravi")
        assert (ravi["order_count"], ravi["total_spent_paise"], ravi["last_order_at"]) == (
            0,
            0,
            None,
        )

        detail = client.get(f"{ADMIN}/customers/{asha['id']}", headers=admin).json()
        assert detail["cancelled_count"] == 1
        assert [o["id"] for o in detail["recent_orders"]] == [cancelled["id"], delivered["id"]]

    def test_search(self, client: TestClient, admin: dict[str, str]) -> None:
        customer(client)
        customer(client, "ravi@example.com")
        found = client.get(f"{ADMIN}/customers?q=ravi", headers=admin).json()["items"]
        assert [c["email"] for c in found] == ["ravi@example.com"]
        assert client.get(f"{ADMIN}/customers?q=98765", headers=admin).json()["total"] == 2

    def test_unknown_or_admin_is_not_a_customer(
        self, client: TestClient, admin: dict[str, str]
    ) -> None:
        me = client.get("/api/v1/me", headers=admin).json()
        assert client.get(f"{ADMIN}/customers/{me['id']}", headers=admin).status_code == 404
        assert client.get(f"{ADMIN}/customers/{uuid.uuid4()}", headers=admin).status_code == 404
