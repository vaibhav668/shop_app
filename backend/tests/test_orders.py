"""Placing, viewing and cancelling orders as a customer (Cash on Delivery)."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Address,
    InventoryMovement,
    InventoryReason,
    Order,
    OrderStatus,
    Product,
    ShopSettings,
)
from tests.factories import make_category, make_product
from tests.helpers import bearer, sign_in
from tests.test_addresses import ADDRESSES, address_body

ORDERS = "/api/v1/orders"


def customer(client: TestClient, email: str = "asha@example.com") -> dict[str, str]:
    headers = bearer(sign_in(client, email=email)["access_token"])
    assert client.patch("/api/v1/me", json={"phone": "9876543210"}, headers=headers).is_success
    return headers


@pytest.fixture
def user(client: TestClient) -> dict[str, str]:
    return customer(client)


@pytest.fixture
def address_id(client: TestClient, user: dict[str, str]) -> str:
    return client.post(ADDRESSES, json=address_body(), headers=user).json()["id"]


@pytest.fixture
def dal(db_session: Session) -> Product:
    product = make_product(
        db_session, make_category(db_session), name="Toor Dal", price_paise=12000, stock_quantity=10
    )
    db_session.commit()
    return product


def body(address_id: str, *pairs: tuple[Product, int], total: int, **extra: Any) -> dict[str, Any]:
    return {
        "address_id": address_id,
        "payment_method": "COD",
        "items": [{"product_id": str(p.id), "quantity": q} for p, q in pairs],
        "idempotency_key": str(uuid.uuid4()),
        "expected_total_paise": total,
    } | extra


def place(client: TestClient, headers: dict[str, str], payload: dict[str, Any]) -> Any:
    return client.post(ORDERS, json=payload, headers=headers)


def error_code(response: Any) -> str:
    return response.json()["error"]["code"]


class TestPlaceOrder:
    def test_cod_order_is_placed_priced_and_stock_taken(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        # 2 x ₹120 = ₹240, below the ₹299 free-delivery line: + ₹20 delivery.
        response = place(
            client, user, body(address_id, (dal, 2), total=26000, customer_note="Ring twice")
        )
        assert response.status_code == 201, response.text
        order = response.json()["order"]
        assert order["order_number"] >= 10001
        assert order["status"] == "PENDING"
        assert (order["payment_method"], order["payment_status"]) == ("COD", "PENDING")
        assert (order["subtotal_paise"], order["delivery_fee_paise"], order["total_paise"]) == (
            24000,
            2000,
            26000,
        )
        assert order["items"][0] | {"image_url": None} == {
            "product_id": str(dal.id),
            "name": "Toor Dal",
            "unit_label": "500 g",
            "image_url": None,
            "unit_price_paise": 12000,
            "mrp_paise": dal.mrp_paise,
            "quantity": 2,
            "line_total_paise": 24000,
        }
        assert order["delivery_address"]["pincode"] == "248001"
        assert order["customer_note"] == "Ring twice"
        assert [s["status"] for s in order["timeline"]] == ["PENDING"]
        assert order["can_cancel"] is True

        db_session.refresh(dal)
        assert dal.stock_quantity == 8
        movement = db_session.scalar(
            select(InventoryMovement).where(InventoryMovement.product_id == dal.id)
        )
        assert (movement.delta, movement.resulting_stock, movement.reason) == (
            -2,
            8,
            InventoryReason.ORDER_PLACED,
        )
        assert str(movement.order_id) == order["id"]

    def test_ordered_items_leave_the_cart_others_stay(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        rice = make_product(db_session, dal.category, price_paise=9000)
        db_session.commit()
        for product in (dal, rice):
            client.put(f"/api/v1/cart/items/{product.id}", json={"quantity": 1}, headers=user)

        assert place(client, user, body(address_id, (dal, 1), total=14000)).status_code == 201
        remaining = client.get("/api/v1/cart", headers=user).json()["lines"]
        assert [line["product"]["id"] for line in remaining] == [str(rice.id)]

    def test_order_keeps_its_copy_of_the_address_and_prices(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"][
            "id"
        ]
        client.patch(f"{ADDRESSES}/{address_id}", json={"line1": "New house"}, headers=user)
        client.delete(f"{ADDRESSES}/{address_id}", headers=user)
        dal.price_paise = dal.mrp_paise = 99900
        db_session.commit()

        order = client.get(f"{ORDERS}/{order_id}", headers=user).json()
        assert order["delivery_address"]["line1"] == "Flat 12, Shanti Apartments"
        assert order["items"][0]["unit_price_paise"] == 12000

    def test_same_idempotency_key_returns_the_same_order(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        payload = body(address_id, (dal, 1), total=14000)
        first = place(client, user, payload)
        second = place(client, user, payload)
        assert (first.status_code, second.status_code) == (201, 200)
        assert first.json()["order"]["id"] == second.json()["order"]["id"]
        db_session.refresh(dal)
        assert dal.stock_quantity == 9  # taken once
        assert client.get(ORDERS, headers=user).json()["total"] == 1

    def test_price_changed_places_nothing(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        response = place(client, user, body(address_id, (dal, 1), total=13000))
        assert response.status_code == 409
        assert error_code(response) == "PRICE_CHANGED"
        assert response.json()["error"]["details"]["total_paise"] == 14000
        db_session.refresh(dal)
        assert dal.stock_quantity == 10
        assert client.get(ORDERS, headers=user).json()["total"] == 0

    @pytest.mark.parametrize(
        ("change", "code", "status"),
        [
            ({"stock_quantity": 1}, "OUT_OF_STOCK", 409),
            ({"stock_quantity": 0}, "OUT_OF_STOCK", 409),
            ({"is_active": False}, "PRODUCT_UNAVAILABLE", 409),
            ({"max_per_order": 1}, "MAX_PER_ORDER", 409),
        ],
    )
    def test_product_problems(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
        change: dict[str, Any],
        code: str,
        status: int,
    ) -> None:
        for field, value in change.items():
            setattr(dal, field, value)
        db_session.commit()
        response = place(client, user, body(address_id, (dal, 2), total=26000))
        assert (response.status_code, error_code(response)) == (status, code)
        assert response.json()["error"]["details"]["product_id"] == str(dal.id)

    def test_shop_rules(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        shop = db_session.get(ShopSettings, 1)
        payload = body(address_id, (dal, 1), total=14000)

        shop.is_accepting_orders = False
        db_session.commit()
        assert error_code(place(client, user, payload)) == "SHOP_CLOSED"

        shop.is_accepting_orders = True
        shop.serviceable_pincodes = ["110001"]
        db_session.commit()
        response = place(client, user, payload)
        assert (response.status_code, error_code(response)) == (422, "NOT_SERVICEABLE")

        shop.serviceable_pincodes = []
        shop.cod_enabled = False
        db_session.commit()
        assert error_code(place(client, user, payload)) == "PAYMENT_METHOD_DISABLED"

    def test_online_payment_is_not_available_yet(
        self, client: TestClient, user: dict[str, str], address_id: str, dal: Product
    ) -> None:
        response = place(
            client, user, body(address_id, (dal, 1), total=14000, payment_method="ONLINE")
        )
        assert (response.status_code, error_code(response)) == (422, "PAYMENT_METHOD_DISABLED")

    def test_below_minimum(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)
        db_session.commit()
        response = place(client, user, body(address_id, (milk, 1), total=4800))
        assert (response.status_code, error_code(response)) == (422, "BELOW_MIN_ORDER")

    def test_phone_required(self, client: TestClient, dal: Product) -> None:
        headers = bearer(sign_in(client, email="nophone@example.com")["access_token"])
        address = client.post(ADDRESSES, json=address_body(), headers=headers).json()["id"]
        response = place(client, headers, body(address, (dal, 1), total=14000))
        assert (response.status_code, error_code(response)) == (422, "PHONE_REQUIRED")

    def test_cannot_use_someone_elses_address(
        self, client: TestClient, address_id: str, dal: Product
    ) -> None:
        other = customer(client, "ravi@example.com")
        assert place(client, other, body(address_id, (dal, 1), total=14000)).status_code == 404

    def test_duplicate_products_rejected(
        self, client: TestClient, user: dict[str, str], address_id: str, dal: Product
    ) -> None:
        response = place(client, user, body(address_id, (dal, 1), (dal, 1), total=26000))
        assert response.status_code == 400


class TestViewingOrders:
    def test_active_and_past_lists(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
    ) -> None:
        first = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"]
        second = place(client, user, body(address_id, (dal, 2), total=26000)).json()["order"]
        client.post(f"{ORDERS}/{first['id']}/cancel", json={}, headers=user)

        active = client.get(ORDERS, headers=user).json()
        past = client.get(f"{ORDERS}?scope=past", headers=user).json()
        assert [o["id"] for o in active["items"]] == [second["id"]]
        assert [o["id"] for o in past["items"]] == [first["id"]]
        assert active["items"][0]["item_count"] == 2

    def test_other_customers_orders_are_invisible(
        self, client: TestClient, user: dict[str, str], address_id: str, dal: Product
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"][
            "id"
        ]
        other = customer(client, "ravi@example.com")
        assert client.get(f"{ORDERS}/{order_id}", headers=other).status_code == 404
        assert client.post(f"{ORDERS}/{order_id}/cancel", json={}, headers=other).status_code == 404
        assert client.get(ORDERS, headers=other).json()["total"] == 0

    def test_requires_sign_in(self, client: TestClient) -> None:
        assert client.get(ORDERS).status_code == 401
        assert client.post(ORDERS, json={}).status_code == 401


class TestCustomerCancel:
    def test_cancel_puts_stock_back(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 3), total=36000)).json()["order"][
            "id"
        ]
        response = client.post(
            f"{ORDERS}/{order_id}/cancel", json={"reason": "Ordered by mistake"}, headers=user
        )
        order = response.json()
        assert response.status_code == 200
        assert order["status"] == "CANCELLED" and order["can_cancel"] is False
        assert order["cancel_reason"] == "Ordered by mistake"
        assert [s["status"] for s in order["timeline"]] == ["PENDING", "CANCELLED"]

        db_session.refresh(dal)
        assert dal.stock_quantity == 10
        reasons = db_session.scalars(
            select(InventoryMovement.reason)
            .where(InventoryMovement.product_id == dal.id)
            .order_by(InventoryMovement.delta)
        ).all()
        assert reasons == [InventoryReason.ORDER_PLACED, InventoryReason.ORDER_CANCELLED]

    def test_cannot_cancel_after_the_shop_accepts(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"][
            "id"
        ]
        db_session.get(Order, uuid.UUID(order_id)).status = OrderStatus.CONFIRMED
        db_session.commit()
        response = client.post(f"{ORDERS}/{order_id}/cancel", json={}, headers=user)
        assert (response.status_code, error_code(response)) == (409, "INVALID_STATUS_TRANSITION")
        assert "call the shop" in response.json()["error"]["message"]
        db_session.refresh(dal)
        assert dal.stock_quantity == 9

    def test_cancelling_twice_is_refused(
        self, client: TestClient, user: dict[str, str], address_id: str, dal: Product
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"][
            "id"
        ]
        client.post(f"{ORDERS}/{order_id}/cancel", json={}, headers=user)
        response = client.post(f"{ORDERS}/{order_id}/cancel", json={}, headers=user)
        assert response.status_code == 409


class TestAccountDeletion:
    def test_blocked_while_an_order_is_active(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        dal: Product,
        db_session: Session,
    ) -> None:
        order_id = place(client, user, body(address_id, (dal, 1), total=14000)).json()["order"][
            "id"
        ]
        response = client.delete("/api/v1/me", headers=user)
        assert (response.status_code, error_code(response)) == (409, "ACTIVE_ORDER")

        client.post(f"{ORDERS}/{order_id}/cancel", json={}, headers=user)
        assert client.delete("/api/v1/me", headers=user).status_code == 204
        # Saved addresses go; the order keeps its own copy for the shop's records.
        order = db_session.get(Order, uuid.UUID(order_id))
        db_session.refresh(order)
        assert order.delivery_line1 == "Flat 12, Shanti Apartments"
        assert (
            db_session.scalars(select(Address).where(Address.user_id == order.user_id)).all() == []
        )
