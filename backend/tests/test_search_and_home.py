from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models import Banner, BannerTarget
from tests.factories import make_category, make_product
from tests.helpers import bearer, promote, sign_in

API = "/api/v1"


@pytest.fixture
def grocery(db_session: Session) -> None:
    dairy = make_category(db_session, name="Dairy", slug="dairy")
    veg = make_category(db_session, name="Vegetables", slug="vegetables")
    make_product(db_session, dairy, name="Toned Milk", search_keywords="doodh")
    make_product(db_session, dairy, name="Milk Bread", search_keywords="pav")
    make_product(db_session, dairy, name="Butter Milk", search_keywords="chaas")
    make_product(db_session, veg, name="Tomato", search_keywords="tamatar")
    make_product(db_session, veg, name="Potato", search_keywords="aloo")
    make_product(db_session, veg, name="Spinach", search_keywords="palak", is_active=False)


def names(client: TestClient, url: str) -> list[str]:
    return [p["name"] for p in client.get(url).json()["items"]]


class TestSearch:
    def test_prefix_matches_rank_first(self, client: TestClient, grocery: None) -> None:
        found = names(client, f"{API}/products?q=milk")
        assert found[0] == "Milk Bread"
        assert sorted(found[1:]) == ["Butter Milk", "Toned Milk"]

    def test_every_word_must_match(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=milk%20toned") == ["Toned Milk"]

    def test_local_names_via_keywords(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=doodh") == ["Toned Milk"]
        assert names(client, f"{API}/products?q=aloo") == ["Potato"]

    def test_tolerates_typos(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=tomatoe") == ["Tomato"]

    def test_case_and_spacing_insensitive(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=%20%20TONED%20%20milk%20") == ["Toned Milk"]

    def test_fuzzy_only_when_nothing_matches_exactly(
        self, client: TestClient, db_session: Session
    ) -> None:
        category = make_category(db_session)
        make_product(db_session, category, name="Tea Leaves", search_keywords="chai patti")
        make_product(db_session, category, name="Chakki Atta")
        assert names(client, f"{API}/products?q=chai") == ["Tea Leaves"]
        assert names(client, f"{API}/products?q=chakky") == ["Chakki Atta"]

    def test_hidden_products_never_match(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=palak") == []

    def test_like_wildcards_are_literal(self, client: TestClient, grocery: None) -> None:
        assert names(client, f"{API}/products?q=%25") == []
        assert names(client, f"{API}/products?q=_") == []

    def test_no_results(self, client: TestClient, grocery: None) -> None:
        body = client.get(f"{API}/products?q=xyzzy").json()
        assert body["items"] == [] and body["total"] == 0

    def test_search_within_category(
        self, client: TestClient, grocery: None, db_session: Session
    ) -> None:
        dairy = client.get(f"{API}/categories/dairy").json()["id"]
        assert names(client, f"{API}/products?q=to&category_id={dairy}") == ["Toned Milk"]


class TestSuggest:
    def test_returns_light_items(self, client: TestClient, grocery: None) -> None:
        body = client.get(f"{API}/products/suggest?q=mil").json()
        assert body[0]["name"] == "Milk Bread"
        assert len(body) == 3
        assert set(body[0]) == {"id", "name", "unit_label", "image_url"}

    def test_capped_at_eight(self, client: TestClient, db_session: Session) -> None:
        category = make_category(db_session)
        for i in range(12):
            make_product(db_session, category, name=f"Rice variety {i}")
        assert len(client.get(f"{API}/products/suggest?q=rice").json()) == 8

    def test_requires_query(self, client: TestClient) -> None:
        assert client.get(f"{API}/products/suggest?q=").status_code == 400


class TestHome:
    def test_featured_first_then_fallback(self, client: TestClient, db_session: Session) -> None:
        category = make_category(db_session)
        make_product(db_session, category, name="Plain")
        assert [p["name"] for p in client.get(f"{API}/home").json()["featured"]] == ["Plain"]

        make_product(db_session, category, name="Star", is_featured=True)
        make_product(db_session, category, name="Sold out star", is_featured=True, stock_quantity=0)
        assert [p["name"] for p in client.get(f"{API}/home").json()["featured"]] == ["Star"]

    def test_banners_respect_active_and_schedule(
        self, client: TestClient, db_session: Session
    ) -> None:
        now = utcnow()
        db_session.add_all(
            [
                Banner(title="Live", sort_order=1),
                Banner(title="Hidden", is_active=False, sort_order=2),
                Banner(title="Future", starts_at=now + timedelta(days=1), sort_order=3),
                Banner(title="Expired", ends_at=now - timedelta(minutes=1), sort_order=4),
            ]
        )
        db_session.flush()
        banners = client.get(f"{API}/home").json()["banners"]
        assert [b["title"] for b in banners] == ["Live"]

    def test_banner_links_resolve_and_hide_gracefully(
        self, client: TestClient, db_session: Session
    ) -> None:
        dairy = make_category(db_session, name="Dairy", slug="dairy")
        hidden = make_category(db_session, is_active=False)
        db_session.add_all(
            [
                Banner(
                    title="To dairy",
                    target_type=BannerTarget.CATEGORY,
                    target_id=dairy.id,
                    sort_order=1,
                ),
                Banner(
                    title="To hidden",
                    target_type=BannerTarget.CATEGORY,
                    target_id=hidden.id,
                    sort_order=2,
                ),
            ]
        )
        db_session.flush()
        to_dairy, to_hidden = client.get(f"{API}/home").json()["banners"]
        assert (to_dairy["target_type"], to_dairy["target_slug"]) == ("CATEGORY", "dairy")
        assert to_hidden["target_type"] == "NONE"


class TestAdminBanners:
    @pytest.fixture
    def admin(self, client: TestClient, db_session: Session) -> dict[str, str]:
        token = sign_in(client, "owner@example.com")["access_token"]
        promote(db_session, "owner@example.com")
        return bearer(token)

    def test_create_update_reorder_delete(
        self, client: TestClient, admin: dict[str, str], db_session: Session
    ) -> None:
        dairy = make_category(db_session, name="Dairy")
        a = client.post(
            f"{API}/admin/banners",
            json={"title": "Fresh milk", "target_type": "CATEGORY", "target_id": str(dairy.id)},
            headers=admin,
        ).json()
        assert a["target_label"] == "Dairy" and a["is_live"] is True
        b = client.post(f"{API}/admin/banners", json={"title": "Diwali"}, headers=admin).json()

        updated = client.patch(
            f"{API}/admin/banners/{a['id']}",
            json={"subtitle": "Delivered by 8 AM", "is_active": False},
            headers=admin,
        ).json()
        assert updated["subtitle"] == "Delivered by 8 AM" and updated["is_live"] is False

        client.post(f"{API}/admin/banners/reorder", json={"ids": [b["id"], a["id"]]}, headers=admin)
        order = [x["title"] for x in client.get(f"{API}/admin/banners", headers=admin).json()]
        assert order == ["Diwali", "Fresh milk"]

        assert client.delete(f"{API}/admin/banners/{b['id']}", headers=admin).status_code == 204

    def test_target_must_match_type(self, client: TestClient, admin: dict[str, str]) -> None:
        response = client.post(
            f"{API}/admin/banners", json={"title": "Oops", "target_type": "CATEGORY"}, headers=admin
        )
        assert response.status_code == 400

    def test_target_must_exist(self, client: TestClient, admin: dict[str, str]) -> None:
        response = client.post(
            f"{API}/admin/banners",
            json={
                "title": "Ghost",
                "target_type": "PRODUCT",
                "target_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=admin,
        )
        assert response.status_code == 404

    def test_schedule_must_be_ordered(self, client: TestClient, admin: dict[str, str]) -> None:
        now = utcnow()
        response = client.post(
            f"{API}/admin/banners",
            json={
                "title": "Backwards",
                "starts_at": now.isoformat(),
                "ends_at": (now - timedelta(days=1)).isoformat(),
            },
            headers=admin,
        )
        assert response.status_code == 400
