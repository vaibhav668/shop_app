"""The shop's side: listing orders, moving them along, cancelling, and the dashboard."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, Product
from app.services.admin_orders import AdminOrderService
from app.services.orders import OrderViews
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
def shopper(client: TestClient) -> dict[str, str]:
    return customer(client)


@pytest.fixture
def dal(db_session: Session) -> Product:
    product = make_product(
        db_session, make_category(db_session), name="Toor Dal", price_paise=12000, stock_quantity=10
    )
    db_session.commit()
    return product


@pytest.fixture
def place(client: TestClient, shopper: dict[str, str], dal: Product):
    address_id = client.post(ADDRESSES, json=address_body(), headers=shopper).json()["id"]

    def _place(quantity: int = 1) -> dict[str, Any]:
        total = 12000 * quantity + (2000 if 12000 * quantity < 29900 else 0)
        response = client.post(
            "/api/v1/orders", json=body(address_id, (dal, quantity), total=total), headers=shopper
        )
        assert response.status_code == 201, response.text
        return response.json()["order"]

    return _place


def move(
    client: TestClient, admin: dict[str, str], order_id: str, to: str, note: str | None = None
) -> Any:
    return client.patch(
        f"{ADMIN}/orders/{order_id}/status", json={"to_status": to, "note": note}, headers=admin
    )


def test_customers_cannot_use_admin_orders(client: TestClient, shopper: dict[str, str]) -> None:
    assert client.get(f"{ADMIN}/orders", headers=shopper).status_code == 403
    assert client.get(f"{ADMIN}/dashboard", headers=shopper).status_code == 403


class TestList:
    def test_newest_first_with_customer_and_area(
        self, client: TestClient, admin: dict[str, str], place
    ) -> None:
        first, second = place(), place(2)
        page = client.get(f"{ADMIN}/orders", headers=admin).json()
        assert [o["id"] for o in page["items"]] == [second["id"], first["id"]]
        row = page["items"][0]
        assert row["customer_phone"] == "9876543210"
        assert row["delivery_area"] == "MG Road, 248001"
        assert row["item_count"] == 2

    def test_filters(
        self, client: TestClient, admin: dict[str, str], place, db_session: Session
    ) -> None:
        pending, confirmed = place(), place()
        move(client, admin, confirmed["id"], "CONFIRMED")

        def ids(query: str) -> list[str]:
            return [
                o["id"]
                for o in client.get(f"{ADMIN}/orders?{query}", headers=admin).json()["items"]
            ]

        assert ids("status=PENDING") == [pending["id"]]
        assert ids("status=CONFIRMED") == [confirmed["id"]]
        assert ids(f"q=%23{pending['order_number']}") == [pending["id"]]
        assert set(ids("q=asha")) == {pending["id"], confirmed["id"]}
        assert set(ids("q=98765")) == {pending["id"], confirmed["id"]}
        assert ids("q=nobody") == []

    def test_unpaid_online_orders_hidden_by_default(
        self, client: TestClient, admin: dict[str, str], place, db_session: Session
    ) -> None:
        order = place()
        db_session.get(Order, uuid.UUID(order["id"])).status = OrderStatus.AWAITING_PAYMENT
        db_session.commit()
        assert client.get(f"{ADMIN}/orders", headers=admin).json()["total"] == 0
        awaiting = client.get(f"{ADMIN}/orders?status=AWAITING_PAYMENT", headers=admin).json()
        assert awaiting["total"] == 1


class TestStatusChanges:
    def test_full_journey_marks_cod_paid_on_delivery(
        self, client: TestClient, admin: dict[str, str], shopper: dict[str, str], place
    ) -> None:
        order = place()
        for step in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"):
            response = move(client, admin, order["id"], step)
            assert response.status_code == 200, response.text
            assert response.json()["payment_status"] == "PENDING"
        delivered = move(client, admin, order["id"], "DELIVERED").json()
        assert delivered["status"] == "DELIVERED"
        assert delivered["payment_status"] == "PAID"
        assert delivered["next_statuses"] == []

        mine = client.get(f"/api/v1/orders/{order['id']}", headers=shopper).json()
        assert [s["status"] for s in mine["timeline"]] == [
            "PENDING",
            "CONFIRMED",
            "PREPARING",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
        ]

    def test_detail_shows_customer_history_and_next_steps(
        self, client: TestClient, admin: dict[str, str], place
    ) -> None:
        order = place()
        detail = client.get(f"{ADMIN}/orders/{order['id']}", headers=admin).json()
        assert detail["customer"]["email"] == "asha@example.com"
        assert detail["next_statuses"] == ["CONFIRMED", "CANCELLED"]
        assert detail["history"][0] | {"at": None} == {
            "from_status": None,
            "to_status": "PENDING",
            "at": None,
            "actor": "CUSTOMER",
            "actor_name": "Asha",
            "note": None,
        }
        moved = move(client, admin, order["id"], "CONFIRMED").json()
        assert moved["history"][-1]["actor"] == "ADMIN"

    def test_skipping_steps_is_refused(
        self, client: TestClient, admin: dict[str, str], place
    ) -> None:
        order = place()
        response = move(client, admin, order["id"], "DELIVERED")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    def test_admin_cannot_mark_an_order_paid_by_moving_it(
        self, client: TestClient, admin: dict[str, str], place, db_session: Session
    ) -> None:
        order = place()
        db_session.get(Order, uuid.UUID(order["id"])).status = OrderStatus.AWAITING_PAYMENT
        db_session.commit()
        assert move(client, admin, order["id"], "PENDING").status_code == 409

    def test_cancel_needs_a_reason_and_restocks(
        self,
        client: TestClient,
        admin: dict[str, str],
        shopper: dict[str, str],
        place,
        dal: Product,
        db_session: Session,
    ) -> None:
        order = place(2)
        move(client, admin, order["id"], "CONFIRMED")
        move(client, admin, order["id"], "PREPARING")

        response = move(client, admin, order["id"], "CANCELLED", note="  ")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "CANCEL_REASON_REQUIRED"

        cancelled = move(client, admin, order["id"], "CANCELLED", note="Out of dal, sorry").json()
        assert cancelled["status"] == "CANCELLED"
        db_session.refresh(dal)
        assert dal.stock_quantity == 10
        mine = client.get(f"/api/v1/orders/{order['id']}", headers=shopper).json()
        assert mine["cancel_reason"] == "Out of dal, sorry"

    def test_unknown_order(self, client: TestClient, admin: dict[str, str]) -> None:
        assert client.get(f"{ADMIN}/orders/{uuid.uuid4()}", headers=admin).status_code == 404


class TestPollingAndDashboard:
    def test_summary(self, client: TestClient, admin: dict[str, str], place) -> None:
        assert client.get(f"{ADMIN}/orders/summary", headers=admin).json() == {
            "pending_count": 0,
            "latest_order_at": None,
        }
        order = place()
        place()
        move(client, admin, order["id"], "CONFIRMED")
        summary = client.get(f"{ADMIN}/orders/summary", headers=admin).json()
        assert summary["pending_count"] == 1
        assert summary["latest_order_at"] is not None

    def test_dashboard(
        self, client: TestClient, admin: dict[str, str], place, dal: Product, db_session: Session
    ) -> None:
        delivered, pending = place(), place(3)
        for step in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"):
            move(client, admin, delivered["id"], step)
        make_product(db_session, dal.category, name="Ghee", stock_quantity=2)
        db_session.commit()

        board = client.get(f"{ADMIN}/dashboard", headers=admin).json()
        assert board["today_orders"] == 2
        assert board["today_revenue_paise"] == delivered["total_paise"]  # only money collected
        assert board["status_counts"] == {
            "PENDING": 1,
            "CONFIRMED": 0,
            "PREPARING": 0,
            "OUT_FOR_DELIVERY": 0,
        }
        assert [p["name"] for p in board["low_stock"]] == ["Ghee"]  # dal has 6 left, above 5
        assert [o["id"] for o in board["recent_orders"]] == [pending["id"], delivered["id"]]

    def test_today_follows_the_shop_timezone(
        self, place, db_session: Session, test_settings
    ) -> None:
        order = db_session.get(Order, uuid.UUID(place()["id"]))
        # 00:30 IST on 2 Oct is 19:00 UTC on 1 Oct.
        order.placed_at = datetime(2026, 10, 1, 19, 0, tzinfo=timezone.utc)
        db_session.commit()
        service = AdminOrderService(db_session, OrderViews(None), "Asia/Kolkata")  # type: ignore[arg-type]

        just_after_midnight_ist = datetime(2026, 10, 1, 19, 30, tzinfo=timezone.utc)
        assert service.dashboard(just_after_midnight_ist).today_orders == 1
        next_day = just_after_midnight_ist + timedelta(days=1)
        assert service.dashboard(next_day).today_orders == 0
