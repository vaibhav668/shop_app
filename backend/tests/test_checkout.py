"""The checkout quote charges exactly what PricingService says and lists every blocking issue."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Product, ShopSettings
from app.services.pricing import quote
from tests.factories import make_category, make_product
from tests.helpers import bearer, sign_in
from tests.test_addresses import ADDRESSES, address_body

QUOTE = "/api/v1/checkout/quote"


@pytest.fixture
def user(client: TestClient) -> dict[str, str]:
    return bearer(sign_in(client)["access_token"])


@pytest.fixture
def address_id(client: TestClient, user: dict[str, str]) -> str:
    return client.post(ADDRESSES, json=address_body(), headers=user).json()["id"]


@pytest.fixture
def shop(db_session: Session) -> ShopSettings:
    return db_session.get(ShopSettings, 1)


def items(*pairs: tuple[Product, int]) -> list[dict[str, Any]]:
    return [{"product_id": str(p.id), "quantity": q} for p, q in pairs]


def post_quote(
    client: TestClient, headers: dict[str, str], address_id: str, *pairs: tuple[Product, int]
) -> Any:
    response = client.post(
        QUOTE, json={"address_id": address_id, "items": items(*pairs)}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def codes(body: dict[str, Any]) -> list[str]:
    return [issue["code"] for issue in body["issues"]]


class TestQuote:
    def test_matches_pricing_service(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        db_session: Session,
        shop: ShopSettings,
    ) -> None:
        category = make_category(db_session)
        milk = make_product(db_session, category, price_paise=2800)
        atta = make_product(db_session, category, price_paise=24500)
        db_session.commit()

        body = post_quote(client, user, address_id, (milk, 2), (atta, 1))
        expected = quote([(milk, 2), (atta, 1)], shop)
        assert body["subtotal_paise"] == expected.subtotal_paise == 30100
        assert body["delivery_fee_paise"] == expected.delivery_fee_paise == 0
        assert body["total_paise"] == expected.total_paise
        assert body["item_count"] == 3
        assert body["address"]["id"] == address_id
        assert body["payment_methods"] == ["COD"]
        assert body["issues"] == [] and body["can_place_order"] is True

    def test_small_order_pays_delivery(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        dal = make_product(db_session, make_category(db_session), price_paise=12000)
        db_session.commit()
        body = post_quote(client, user, address_id, (dal, 1))
        assert (body["subtotal_paise"], body["delivery_fee_paise"], body["total_paise"]) == (
            12000,
            2000,
            14000,
        )

    def test_client_cannot_send_prices(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        dal = make_product(db_session, make_category(db_session), price_paise=12000)
        db_session.commit()
        response = client.post(
            QUOTE,
            json={
                "address_id": address_id,
                "items": [{"product_id": str(dal.id), "quantity": 1, "price_paise": 1}],
                "total_paise": 1,
            },
            headers=user,
        )
        assert response.json()["total_paise"] == 14000

    def test_changes_nothing(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        dal = make_product(db_session, make_category(db_session), stock_quantity=5)
        db_session.commit()
        post_quote(client, user, address_id, (dal, 3))
        db_session.refresh(dal)
        assert dal.stock_quantity == 5
        assert client.get("/api/v1/cart", headers=user).json()["lines"] == []


class TestBlockingIssues:
    def test_below_minimum(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)
        db_session.commit()
        body = post_quote(client, user, address_id, (milk, 1))
        assert codes(body) == ["BELOW_MIN_ORDER"]
        assert body["issues"][0]["message"] == "Minimum order is ₹99. Add ₹71 more."
        assert body["can_place_order"] is False

    def test_shop_closed(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        db_session: Session,
        shop: ShopSettings,
    ) -> None:
        dal = make_product(db_session, make_category(db_session), price_paise=12000)
        shop.is_accepting_orders = False
        shop.closed_message = "Closed for Diwali. Back on Monday."
        db_session.commit()
        body = post_quote(client, user, address_id, (dal, 1))
        assert body["issues"] == [
            {"code": "SHOP_CLOSED", "message": "Closed for Diwali. Back on Monday."}
        ]

    def test_unserviceable_pincode(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        db_session: Session,
        shop: ShopSettings,
    ) -> None:
        dal = make_product(db_session, make_category(db_session), price_paise=12000)
        shop.serviceable_pincodes = ["110001"]
        db_session.commit()
        body = post_quote(client, user, address_id, (dal, 1))
        assert codes(body) == ["NOT_SERVICEABLE"]
        assert "248001" in body["issues"][0]["message"]
        assert body["address"]["is_serviceable"] is False

    def test_out_of_stock_and_reduced_items(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        category = make_category(db_session)
        gone = make_product(db_session, category, price_paise=12000, stock_quantity=0)
        few = make_product(db_session, category, price_paise=12000, stock_quantity=2)
        db_session.commit()
        body = post_quote(client, user, address_id, (gone, 1), (few, 3))
        assert [line["issue"] for line in body["lines"]] == ["OUT_OF_STOCK", "QUANTITY_REDUCED"]
        assert body["subtotal_paise"] == 24000  # only what can actually be sold
        assert codes(body) == ["ITEMS_CHANGED"]

    def test_nothing_sellable(
        self, client: TestClient, user: dict[str, str], address_id: str, db_session: Session
    ) -> None:
        hidden = make_product(db_session, make_category(db_session), is_active=False)
        db_session.commit()
        body = post_quote(client, user, address_id, (hidden, 1))
        assert codes(body) == ["ITEMS_CHANGED", "EMPTY_ORDER"]

    def test_no_payment_method(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        db_session: Session,
        shop: ShopSettings,
    ) -> None:
        dal = make_product(db_session, make_category(db_session), price_paise=12000)
        # Online is on but not supported until Phase 8, so nothing can be used.
        shop.cod_enabled = False
        db_session.commit()
        body = post_quote(client, user, address_id, (dal, 1))
        assert body["payment_methods"] == []
        assert codes(body) == ["NO_PAYMENT_METHOD"]

    def test_several_issues_are_reported_together(
        self,
        client: TestClient,
        user: dict[str, str],
        address_id: str,
        db_session: Session,
        shop: ShopSettings,
    ) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)
        shop.is_accepting_orders = False
        shop.serviceable_pincodes = ["110001"]
        db_session.commit()
        body = post_quote(client, user, address_id, (milk, 1))
        assert codes(body) == ["SHOP_CLOSED", "NOT_SERVICEABLE", "BELOW_MIN_ORDER"]


class TestRequest:
    def test_other_users_address_is_not_found(
        self, client: TestClient, address_id: str, db_session: Session
    ) -> None:
        dal = make_product(db_session, make_category(db_session))
        db_session.commit()
        other = bearer(sign_in(client, email="ravi@example.com")["access_token"])
        response = client.post(
            QUOTE, json={"address_id": address_id, "items": items((dal, 1))}, headers=other
        )
        assert response.status_code == 404

    @pytest.mark.parametrize(
        "bad_items",
        [
            [],
            [{"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 0}],
            [{"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 51}],
            [
                {"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 1},
                {"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 2},
            ],
        ],
    )
    def test_rejects_bad_items(
        self, client: TestClient, user: dict[str, str], address_id: str, bad_items: list[Any]
    ) -> None:
        response = client.post(
            QUOTE, json={"address_id": address_id, "items": bad_items}, headers=user
        )
        assert response.status_code == 400

    def test_unknown_products_are_dropped(
        self, client: TestClient, user: dict[str, str], address_id: str
    ) -> None:
        response = client.post(
            QUOTE,
            json={
                "address_id": address_id,
                "items": [{"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 1}],
            },
            headers=user,
        )
        body = response.json()
        assert body["lines"] == [] and "EMPTY_ORDER" in codes(body)

    def test_requires_sign_in(self, client: TestClient) -> None:
        assert client.post(QUOTE, json={}).status_code == 401
