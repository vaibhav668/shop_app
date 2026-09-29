import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InventoryMovement, InventoryReason
from tests.factories import make_category, make_product
from tests.helpers import bearer, promote, sign_in

ADMIN = "/api/v1/admin"


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> dict[str, str]:
    token = sign_in(client, "owner@example.com")["access_token"]
    promote(db_session, "owner@example.com")
    return bearer(token)


def png_bytes(size: tuple[int, int] = (40, 30)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (22, 163, 74)).save(out, format="PNG")
    return out.getvalue()


class TestCategories:
    def test_create_list_update_reorder(self, client: TestClient, admin: dict[str, str]) -> None:
        dairy = client.post(f"{ADMIN}/categories", json={"name": "Dairy"}, headers=admin).json()
        bakery = client.post(f"{ADMIN}/categories", json={"name": "Bakery"}, headers=admin).json()
        assert dairy["slug"] == "dairy"

        renamed = client.patch(
            f"{ADMIN}/categories/{dairy['id']}", json={"name": "Dairy & Eggs"}, headers=admin
        ).json()
        assert renamed["slug"] == "dairy-eggs"

        client.post(
            f"{ADMIN}/categories/reorder", json={"ids": [bakery["id"], dairy["id"]]}, headers=admin
        )
        names = [c["name"] for c in client.get(f"{ADMIN}/categories", headers=admin).json()]
        assert names == ["Bakery", "Dairy & Eggs"]

    def test_duplicate_names_get_unique_slugs(
        self, client: TestClient, admin: dict[str, str]
    ) -> None:
        a = client.post(f"{ADMIN}/categories", json={"name": "Snacks"}, headers=admin).json()
        b = client.post(f"{ADMIN}/categories", json={"name": "Snacks"}, headers=admin).json()
        assert (a["slug"], b["slug"]) == ("snacks", "snacks-2")

    def test_cannot_delete_non_empty_category(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        make_product(db_session, category)
        response = client.delete(f"{ADMIN}/categories/{category.id}", headers=admin)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "CATEGORY_NOT_EMPTY"

    def test_delete_empty_category(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        assert client.delete(f"{ADMIN}/categories/{category.id}", headers=admin).status_code == 204

    def test_reorder_must_include_every_category(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        a = make_category(db_session)
        make_category(db_session)
        response = client.post(
            f"{ADMIN}/categories/reorder", json={"ids": [str(a.id)]}, headers=admin
        )
        assert response.status_code == 400


class TestProducts:
    def product_payload(self, category_id: str, **overrides: object) -> dict[str, object]:
        return {
            "category_id": category_id,
            "name": "Toned Milk",
            "unit_label": "500 ml",
            "price_paise": 2800,
            "mrp_paise": 3000,
            "stock_quantity": 24,
        } | overrides

    def test_create_logs_initial_stock(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        response = client.post(
            f"{ADMIN}/products", json=self.product_payload(str(category.id)), headers=admin
        )
        assert response.status_code == 201
        product = response.json()
        assert product["slug"] == "toned-milk"
        assert product["stock_quantity"] == 24

        movements = db_session.scalars(select(InventoryMovement)).all()
        assert [(m.reason, m.delta, m.resulting_stock) for m in movements] == [
            (InventoryReason.INITIAL, 24, 24)
        ]

    def test_mrp_below_price_rejected(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        payload = self.product_payload(str(category.id), price_paise=5000, mrp_paise=4000)
        response = client.post(f"{ADMIN}/products", json=payload, headers=admin)
        assert response.status_code == 400

    def test_update_checks_price_against_existing_mrp(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(
            db_session, make_category(db_session), price_paise=4500, mrp_paise=5000
        )
        response = client.patch(
            f"{ADMIN}/products/{product.id}", json={"price_paise": 6000}, headers=admin
        )
        assert response.status_code == 400

    def test_update_fields_and_clear_optional(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session), max_per_order=5)
        body = client.patch(
            f"{ADMIN}/products/{product.id}",
            json={"name": "Amul Taaza", "max_per_order": None, "is_featured": True},
            headers=admin,
        ).json()
        assert body["name"] == "Amul Taaza"
        assert body["max_per_order"] is None
        assert body["is_featured"] is True

    def test_stock_is_not_editable_through_product_update(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session), stock_quantity=10)
        body = client.patch(
            f"{ADMIN}/products/{product.id}", json={"stock_quantity": 99}, headers=admin
        ).json()
        assert body["stock_quantity"] == 10

    def test_archive_hides_from_customers_and_restore(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session))
        archived = client.delete(f"{ADMIN}/products/{product.id}", headers=admin).json()
        assert archived["archived_at"] is not None
        assert client.get(f"/api/v1/products/{product.id}").status_code == 404

        client.post(f"{ADMIN}/products/{product.id}/restore", headers=admin)
        assert client.get(f"/api/v1/products/{product.id}").status_code == 200

    def test_list_filters(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        category = make_category(db_session)
        make_product(db_session, category, name="Toned Milk", search_keywords="doodh")
        make_product(db_session, category, name="Bread", stock_quantity=2)
        make_product(db_session, category, name="Hidden Jam", is_active=False)

        def names(query: str) -> list[str]:
            items = client.get(f"{ADMIN}/products?{query}", headers=admin).json()["items"]
            return [p["name"] for p in items]

        assert names("q=doodh") == ["Toned Milk"]
        assert names("low_stock=true") == ["Bread"]
        assert names("status=inactive") == ["Hidden Jam"]
        assert sorted(names("status=all")) == ["Bread", "Hidden Jam", "Toned Milk"]


class TestStock:
    def test_set_stock_with_matching_expectation(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session), stock_quantity=10)
        response = client.patch(
            f"{ADMIN}/products/{product.id}/stock",
            json={"stock": 25, "expected_stock": 10},
            headers=admin,
        )
        assert response.json()["stock_quantity"] == 25
        movement = db_session.scalars(select(InventoryMovement)).one()
        assert (movement.reason, movement.delta, movement.resulting_stock) == (
            InventoryReason.STOCK_SET,
            15,
            25,
        )

    def test_set_stock_conflict_when_stock_moved(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session), stock_quantity=8)
        response = client.patch(
            f"{ADMIN}/products/{product.id}/stock",
            json={"stock": 24, "expected_stock": 10},
            headers=admin,
        )
        assert response.status_code == 409
        error = response.json()["error"]
        assert error["code"] == "STOCK_CONFLICT"
        assert error["details"]["current"] == 8

    def test_adjust_up_and_down(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        product = make_product(db_session, make_category(db_session), stock_quantity=5)
        url = f"{ADMIN}/products/{product.id}/stock-adjust"
        assert client.post(url, json={"delta": 3}, headers=admin).json()["stock_quantity"] == 8
        assert client.post(url, json={"delta": -8}, headers=admin).json()["stock_quantity"] == 0

        too_far = client.post(url, json={"delta": -1}, headers=admin)
        assert too_far.status_code == 409
        assert too_far.json()["error"]["code"] == "STOCK_WOULD_GO_NEGATIVE"


class TestUploads:
    def test_upload_reencodes_to_webp(self, client: TestClient, admin: dict[str, str]) -> None:
        response = client.post(
            f"{ADMIN}/uploads/images",
            files={"file": ("photo.png", png_bytes(), "image/png")},
            headers=admin,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["key"].startswith("catalog/") and body["key"].endswith(".webp")

        served = client.get(body["url"].replace("http://testserver", ""))
        assert served.status_code == 200
        assert Image.open(io.BytesIO(served.content)).format == "WEBP"

    def test_rejects_non_images(self, client: TestClient, admin: dict[str, str]) -> None:
        response = client.post(
            f"{ADMIN}/uploads/images",
            files={"file": ("notes.png", b"definitely not an image", "image/png")},
            headers=admin,
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_IMAGE"

    def test_product_image_url_comes_from_storage(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        key = client.post(
            f"{ADMIN}/uploads/images",
            files={"file": ("photo.png", png_bytes(), "image/png")},
            headers=admin,
        ).json()["key"]
        product = make_product(db_session, make_category(db_session), image_key=key)
        card = client.get(f"/api/v1/products/{product.id}").json()
        assert card["image_url"] == f"http://testserver/media/{key}"
