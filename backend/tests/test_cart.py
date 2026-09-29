"""The cart stores product IDs and quantities only; every price and total comes from the server."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models import Product, ShopSettings
from app.services.pricing import delivery_fee_for, quote
from tests.factories import make_category, make_product
from tests.helpers import bearer, sign_in

CART = "/api/v1/cart"


@pytest.fixture
def user(client: TestClient) -> dict[str, str]:
    return bearer(sign_in(client)["access_token"])


def put(client: TestClient, headers: dict[str, str], product: Product, quantity: int):
    return client.put(f"{CART}/items/{product.id}", json={"quantity": quantity}, headers=headers)


class TestPricing:
    """Shop defaults: ₹20 delivery, free above ₹299, minimum order ₹99."""

    settings = ShopSettings(
        delivery_fee_paise=2000, free_delivery_above_paise=29900, min_order_paise=9900
    )

    @pytest.mark.parametrize(
        ("subtotal", "fee"), [(0, 0), (9900, 2000), (29899, 2000), (29900, 0), (50000, 0)]
    )
    def test_delivery_fee_boundaries(self, subtotal: int, fee: int) -> None:
        assert delivery_fee_for(subtotal, self.settings) == fee

    def test_quote_totals(self, db_session: Session) -> None:
        category = make_category(db_session)
        milk = make_product(db_session, category, price_paise=2800)
        atta = make_product(db_session, category, price_paise=24500)
        result = quote([(milk, 2), (atta, 1)], self.settings)
        assert result.subtotal_paise == 30100
        assert result.delivery_fee_paise == 0
        assert result.total_paise == 30100
        assert result.item_count == 3
        assert result.min_order_remaining_paise == 0

    def test_small_order_pays_delivery_and_sees_nudges(self, db_session: Session) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)
        result = quote([(milk, 1)], self.settings)
        assert (result.delivery_fee_paise, result.total_paise) == (2000, 4800)
        assert result.free_delivery_remaining_paise == 29900 - 2800
        assert result.min_order_remaining_paise == 9900 - 2800


class TestCart:
    def test_empty_cart(self, client: TestClient, user: dict[str, str]) -> None:
        cart = client.get(CART, headers=user).json()
        assert cart["lines"] == [] and cart["total_paise"] == 0
        assert cart["rules"]["free_delivery_above_paise"] == 29900

    def test_requires_sign_in(self, client: TestClient) -> None:
        assert client.get(CART).status_code == 401

    def test_add_change_remove(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)

        cart = put(client, user, milk, 2).json()
        assert cart["lines"][0]["quantity"] == 2
        assert cart["subtotal_paise"] == 5600
        assert cart["delivery_fee_paise"] == 2000

        assert put(client, user, milk, 3).json()["subtotal_paise"] == 8400
        assert put(client, user, milk, 0).json()["lines"] == []

    def test_setting_same_quantity_twice_is_idempotent(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session))
        first = put(client, user, milk, 2).json()
        second = put(client, user, milk, 2).json()
        assert first["lines"][0]["quantity"] == second["lines"][0]["quantity"] == 2
        assert len(second["lines"]) == 1

    def test_cannot_add_out_of_stock(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        curd = make_product(db_session, make_category(db_session), stock_quantity=0)
        response = put(client, user, curd, 1)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "OUT_OF_STOCK"

    def test_cannot_exceed_stock(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        butter = make_product(db_session, make_category(db_session), stock_quantity=3)
        response = put(client, user, butter, 4)
        assert response.status_code == 409
        assert response.json()["error"]["details"]["available"] == 3

    def test_max_per_order(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        offer = make_product(db_session, make_category(db_session), max_per_order=2)
        response = put(client, user, offer, 3)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "MAX_PER_ORDER"

    def test_hard_cap_of_fifty(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        rice = make_product(db_session, make_category(db_session), stock_quantity=500)
        assert put(client, user, rice, 51).status_code == 400

    def test_cannot_add_hidden_product(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        hidden = make_product(db_session, make_category(db_session), is_active=False)
        response = put(client, user, hidden, 1)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "PRODUCT_UNAVAILABLE"

    def test_lowering_is_allowed_after_stock_drops(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        eggs = make_product(db_session, make_category(db_session), stock_quantity=10)
        put(client, user, eggs, 8)
        eggs.stock_quantity = 2
        db_session.flush()
        response = put(client, user, eggs, 6)
        assert response.status_code == 200

    def test_flags_items_that_changed_since_adding(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        milk = make_product(db_session, category, price_paise=2800, stock_quantity=10)
        bread = make_product(db_session, category, price_paise=4500, stock_quantity=10)
        jam = make_product(db_session, category, price_paise=9000, stock_quantity=10)
        for product in (milk, bread, jam):
            put(client, user, product, 4)

        milk.stock_quantity = 2  # sold elsewhere
        bread.stock_quantity = 0
        jam.archived_at = utcnow()
        db_session.flush()

        cart = client.get(CART, headers=user).json()
        issues = {line["product"]["id"]: line for line in cart["lines"]}
        assert issues[str(milk.id)]["issue"] == "QUANTITY_REDUCED"
        assert issues[str(milk.id)]["available_quantity"] == 2
        assert issues[str(bread.id)]["issue"] == "OUT_OF_STOCK"
        assert issues[str(jam.id)]["issue"] == "UNAVAILABLE"
        # Only what can actually be sold is charged.
        assert cart["subtotal_paise"] == 2 * 2800
        assert cart["has_issues"] is True

    def test_price_changes_are_reflected_immediately(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session), price_paise=2800)
        put(client, user, milk, 1)
        milk.price_paise = 3000
        milk.mrp_paise = 3000
        db_session.flush()
        assert client.get(CART, headers=user).json()["subtotal_paise"] == 3000

    def test_carts_are_private(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        milk = make_product(db_session, make_category(db_session))
        put(client, user, milk, 1)
        other = bearer(sign_in(client, "ravi@example.com")["access_token"])
        assert client.get(CART, headers=other).json()["lines"] == []

    def test_clear(self, client: TestClient, user: dict[str, str], db_session: Session) -> None:
        category = make_category(db_session)
        put(client, user, make_product(db_session, category), 1)
        put(client, user, make_product(db_session, category), 1)
        assert client.delete(CART, headers=user).json()["lines"] == []


class TestFavourites:
    def test_add_list_ids_remove(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        milk = make_product(db_session, category, name="Milk")
        bread = make_product(db_session, category, name="Bread")

        for product in (milk, bread, milk):  # repeat is harmless
            assert client.put(f"/api/v1/favourites/{product.id}", headers=user).status_code == 204

        page = client.get("/api/v1/favourites", headers=user).json()
        assert [p["name"] for p in page["items"]] == ["Bread", "Milk"]  # newest first
        ids = client.get("/api/v1/favourites/ids", headers=user).json()
        assert sorted(ids) == sorted([str(milk.id), str(bread.id)])

        client.delete(f"/api/v1/favourites/{milk.id}", headers=user)
        assert client.get("/api/v1/favourites", headers=user).json()["total"] == 1

    def test_hidden_favourites_are_not_listed(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session))
        client.put(f"/api/v1/favourites/{product.id}", headers=user)
        product.is_active = False
        db_session.flush()
        assert client.get("/api/v1/favourites", headers=user).json()["items"] == []

    def test_cannot_favourite_unknown_product(
        self, client: TestClient, user: dict[str, str]
    ) -> None:
        response = client.put(
            "/api/v1/favourites/00000000-0000-0000-0000-000000000000", headers=user
        )
        assert response.status_code == 404
