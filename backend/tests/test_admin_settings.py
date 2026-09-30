"""Shop settings: admin-only, partial updates, validation, and their effect on customers."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ShopSettings
from tests.helpers import bearer, promote, sign_in

SETTINGS = "/api/v1/admin/settings"


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> dict[str, str]:
    sign_in(client, email="owner@example.com")
    promote(db_session, "owner@example.com")
    return bearer(sign_in(client, email="owner@example.com")["access_token"])


def patch(client: TestClient, headers: dict[str, str], **fields: Any) -> Any:
    return client.patch(SETTINGS, json=fields, headers=headers)


def test_customers_cannot_read_or_change_settings(client: TestClient) -> None:
    customer = bearer(sign_in(client)["access_token"])
    assert client.get(SETTINGS, headers=customer).status_code == 403
    assert patch(client, customer, delivery_fee_paise=0).status_code == 403


def test_defaults(client: TestClient, admin: dict[str, str]) -> None:
    body = client.get(SETTINGS, headers=admin).json()
    assert body["delivery_fee_paise"] == 2000
    assert body["free_delivery_above_paise"] == 29900
    assert body["min_order_paise"] == 9900
    assert body["serviceable_pincodes"] == []
    assert body["empty_pincodes_accept_all"] is True  # the test environment


def test_partial_update(client: TestClient, admin: dict[str, str], db_session: Session) -> None:
    response = patch(client, admin, delivery_fee_paise=3000, is_accepting_orders=False)
    body = response.json()
    assert response.status_code == 200
    assert body["delivery_fee_paise"] == 3000 and body["is_accepting_orders"] is False
    assert body["min_order_paise"] == 9900  # untouched
    assert body["updated_at"] is not None

    # Customers see the new rules straight away.
    shop = client.get("/api/v1/shop").json()
    assert shop["delivery_fee_paise"] == 3000 and shop["is_accepting_orders"] is False


def test_delivery_promise_is_editable_and_public(client: TestClient, admin: dict[str, str]) -> None:
    assert client.get("/api/v1/shop").json()["delivery_eta_minutes"] == 30  # the default
    assert patch(client, admin, delivery_eta_minutes=45).json()["delivery_eta_minutes"] == 45
    assert client.get("/api/v1/shop").json()["delivery_eta_minutes"] == 45


def test_pincodes_are_trimmed_deduplicated_and_sorted(
    client: TestClient, admin: dict[str, str]
) -> None:
    body = patch(client, admin, serviceable_pincodes=["248002", " 248001", "248002"]).json()
    assert body["serviceable_pincodes"] == ["248001", "248002"]


def test_optional_text_can_be_cleared(client: TestClient, admin: dict[str, str]) -> None:
    patch(client, admin, shop_phone="+91 98765 43210", shop_address="12 Paltan Bazaar")
    body = patch(client, admin, shop_phone="", shop_address=None).json()
    assert body["shop_phone"] is None and body["shop_address"] is None


@pytest.mark.parametrize(
    "fields",
    [
        {"delivery_fee_paise": -1},
        {"min_order_paise": 1_000_001},
        {"serviceable_pincodes": ["24800"]},
        {"serviceable_pincodes": ["048001"]},
        {"closed_message": " "},
        {"shop_name": ""},
        {"shop_phone": "call me"},
        {"payment_timeout_minutes": 2},
        {"delivery_eta_minutes": 4},
        {"delivery_eta_minutes": 241},
    ],
)
def test_rejects_bad_values(
    client: TestClient, admin: dict[str, str], fields: dict[str, Any]
) -> None:
    response = patch(client, admin, **fields)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_at_least_one_payment_method_stays_on(
    client: TestClient, admin: dict[str, str], db_session: Session
) -> None:
    response = patch(client, admin, cod_enabled=False, online_payment_enabled=False)
    assert response.status_code == 400
    assert "payment method" in response.json()["error"]["message"]
    shop = db_session.get(ShopSettings, 1)
    db_session.refresh(shop)
    assert shop.cod_enabled and shop.online_payment_enabled


def test_null_for_a_required_field_means_unchanged(
    client: TestClient, admin: dict[str, str]
) -> None:
    body = patch(client, admin, shop_name=None, closed_message=None).json()
    assert body["shop_name"] == "Bada Bazar"
