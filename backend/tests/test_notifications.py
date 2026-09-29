"""Order notifications: one row per status change, pushed after commit, dead tokens pruned."""

import uuid
from contextlib import nullcontext
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.integrations.push import FakePushProvider, PushMessage, PushResult
from app.integrations.push.fcm import FcmPushProvider
from app.models import DeviceToken, Notification, Product
from app.services.notifications import PushDelivery
from tests.factories import make_category, make_product, make_user
from tests.helpers import bearer, promote, sign_in
from tests.test_addresses import ADDRESSES, address_body
from tests.test_admin_orders import move
from tests.test_orders import body, customer

NOTIFICATIONS = "/api/v1/notifications"


@pytest.fixture
def shopper(client: TestClient) -> dict[str, str]:
    headers = customer(client)
    register_device(client, headers, "phone-token-1")
    return headers


def register_device(client: TestClient, headers: dict[str, str], token: str) -> None:
    response = client.post(
        "/api/v1/me/devices", json={"token": token, "platform": "android"}, headers=headers
    )
    assert response.status_code == 204, response.text


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> dict[str, str]:
    sign_in(client, email="owner@example.com")
    promote(db_session, "owner@example.com")
    return bearer(sign_in(client, email="owner@example.com")["access_token"])


@pytest.fixture
def dal(db_session: Session) -> Product:
    product = make_product(db_session, make_category(db_session), price_paise=12000)
    db_session.commit()
    return product


@pytest.fixture
def order(client: TestClient, shopper: dict[str, str], dal: Product) -> dict[str, Any]:
    address_id = client.post(ADDRESSES, json=address_body(), headers=shopper).json()["id"]
    response = client.post(
        "/api/v1/orders", json=body(address_id, (dal, 1), total=14000), headers=shopper
    )
    assert response.status_code == 201
    return response.json()["order"]


def titles(push: FakePushProvider) -> list[str]:
    return [message.title for _, message in push.sent]


class TestOrderNotifications:
    def test_placing_an_order_notifies_and_pushes(
        self, client: TestClient, shopper: dict[str, str], order: dict[str, Any], push
    ) -> None:
        assert titles(push) == ["Order placed"]
        token, message = push.sent[0]
        assert token == "phone-token-1"
        assert f"#{order['order_number']}" in message.body
        assert message.data == {
            "order_id": order["id"],
            "status": "PENDING",
            "route": f"/orders/{order['id']}",
        }
        page = client.get(NOTIFICATIONS, headers=shopper).json()
        assert [n["title"] for n in page["items"]] == ["Order placed"]
        assert page["items"][0]["read_at"] is None

    def test_every_shop_step_notifies(
        self,
        client: TestClient,
        admin: dict[str, str],
        shopper: dict[str, str],
        order: dict[str, Any],
        push,
    ) -> None:
        for step in ("CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"):
            assert move(client, admin, order["id"], step).status_code == 200
        assert titles(push) == [
            "Order placed",
            "Order confirmed",
            "Packing your order",
            "Out for delivery",
            "Delivered",
        ]
        # Cash orders remind the customer how much to keep ready.
        assert "keep ₹140 ready" in push.sent[3][1].body
        page = client.get(NOTIFICATIONS, headers=shopper).json()
        assert page["total"] == 5
        assert page["items"][0]["title"] == "Delivered"  # newest first

    def test_shop_cancel_tells_the_customer_why(
        self, client: TestClient, admin: dict[str, str], order: dict[str, Any], push
    ) -> None:
        move(client, admin, order["id"], "CANCELLED", note="Out of dal, sorry")
        assert push.sent[-1][1].title == "Order cancelled"
        assert push.sent[-1][1].body.endswith("was cancelled: Out of dal, sorry")

    def test_customer_cancel_does_not_notify_them(
        self, client: TestClient, shopper: dict[str, str], order: dict[str, Any], push
    ) -> None:
        client.post(f"/api/v1/orders/{order['id']}/cancel", json={}, headers=shopper)
        assert titles(push) == ["Order placed"]

    def test_refused_change_sends_nothing(
        self, client: TestClient, admin: dict[str, str], order: dict[str, Any], push
    ) -> None:
        assert move(client, admin, order["id"], "DELIVERED").status_code == 409
        assert titles(push) == ["Order placed"]

    def test_no_devices_still_records_the_notification(
        self, client: TestClient, dal: Product, push
    ) -> None:
        headers = customer(client, "ravi@example.com")  # never registered a phone
        address_id = client.post(ADDRESSES, json=address_body(), headers=headers).json()["id"]
        client.post("/api/v1/orders", json=body(address_id, (dal, 1), total=14000), headers=headers)
        assert push.sent == []
        assert client.get(NOTIFICATIONS, headers=headers).json()["total"] == 1


class TestReading:
    def test_unread_count_and_read_all(
        self,
        client: TestClient,
        admin: dict[str, str],
        shopper: dict[str, str],
        order: dict[str, Any],
    ) -> None:
        move(client, admin, order["id"], "CONFIRMED")
        assert client.get(f"{NOTIFICATIONS}/unread-count", headers=shopper).json() == {"count": 2}
        assert client.post(f"{NOTIFICATIONS}/read-all", headers=shopper).status_code == 204
        assert client.get(f"{NOTIFICATIONS}/unread-count", headers=shopper).json() == {"count": 0}
        assert all(n["read_at"] for n in client.get(NOTIFICATIONS, headers=shopper).json()["items"])

    def test_only_your_own(self, client: TestClient, order: dict[str, Any]) -> None:
        other = customer(client, "ravi@example.com")
        assert client.get(NOTIFICATIONS, headers=other).json()["total"] == 0
        client.post(f"{NOTIFICATIONS}/read-all", headers=other)

    def test_requires_sign_in(self, client: TestClient) -> None:
        assert client.get(NOTIFICATIONS).status_code == 401


class TestDelivery:
    def test_dead_tokens_are_forgotten(
        self, client: TestClient, db_session: Session, dal: Product, push
    ) -> None:
        headers = customer(client)
        for token in ("phone-token-1", "invalid-old-phone-token"):
            register_device(client, headers, token)
        address_id = client.post(ADDRESSES, json=address_body(), headers=headers).json()["id"]
        client.post("/api/v1/orders", json=body(address_id, (dal, 1), total=14000), headers=headers)

        assert [token for token, _ in push.sent] == ["phone-token-1"]
        remaining = db_session.scalars(select(DeviceToken.token)).all()
        assert remaining == ["phone-token-1"]

    def test_nothing_is_pushed_for_a_rolled_back_change(self, db_session: Session) -> None:
        push = FakePushProvider()
        delivery = PushDelivery(lambda: nullcontext(db_session), push)
        # The id of a notification whose transaction never committed: no row exists.
        delivery.deliver(uuid.uuid4())
        assert push.sent == []

    def test_a_failing_push_service_never_raises(self, db_session: Session) -> None:
        class Broken:
            def send(self, tokens: list[str], message: PushMessage) -> PushResult:
                raise RuntimeError("FCM is down")

        user = make_user(db_session)
        db_session.add(
            DeviceToken(user_id=user.id, token="t", platform="android", last_seen_at=utcnow())
        )
        note = Notification(user_id=user.id, type="ORDER_STATUS", title="t", body="b", data={})
        db_session.add(note)
        db_session.flush()
        PushDelivery(lambda: nullcontext(db_session), Broken()).deliver(note.id)  # no exception


class TestFcmProvider:
    """The real provider, with Google's endpoints replaced: dead tokens are recognised."""

    def test_sends_and_classifies_errors(self, monkeypatch: pytest.MonkeyPatch) -> None:
        provider = FcmPushProvider.__new__(FcmPushProvider)
        provider._project_id = "bada-bazar"
        provider._timeout = 5
        monkeypatch.setattr(provider, "_access_token", lambda: "token", raising=False)

        def handler(request: httpx.Request) -> httpx.Response:
            token = request.read().decode()
            if '"dead"' in token:
                return httpx.Response(
                    404,
                    json={
                        "error": {
                            "status": "NOT_FOUND",
                            "details": [{"errorCode": "UNREGISTERED"}],
                        }
                    },
                )
            if '"flaky"' in token:
                return httpx.Response(503, json={"error": {"status": "UNAVAILABLE"}})
            assert request.headers["Authorization"] == "Bearer token"
            assert request.url.path == "/v1/projects/bada-bazar/messages:send"
            return httpx.Response(200, json={"name": "projects/bada-bazar/messages/1"})

        real_client = httpx.Client
        monkeypatch.setattr(
            "app.integrations.push.fcm.httpx.Client",
            lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
        )
        result = provider.send(
            ["good", "dead", "flaky"], PushMessage(title="Hi", body="There", data={"a": "1"})
        )
        assert result.sent == 1
        assert result.invalid_tokens == ["dead"]  # a temporary error keeps the token
