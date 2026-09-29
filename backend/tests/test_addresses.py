"""Saved addresses: one default per user, ownership, validation and serviceability flags."""

from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import MAX_ADDRESSES_PER_USER, Address, ShopSettings
from app.services.delivery import DeliveryArea
from app.utils.money import format_rupees
from tests.helpers import bearer, sign_in

ADDRESSES = "/api/v1/addresses"


def address_body(**overrides: Any) -> dict[str, Any]:
    return {
        "label": "Home",
        "recipient_name": "Asha Verma",
        "phone": "9876543210",
        "line1": "Flat 12, Shanti Apartments",
        "line2": "MG Road",
        "landmark": "Near the post office",
        "city": "Dehradun",
        "state": "Uttarakhand",
        "pincode": "248001",
    } | overrides


@pytest.fixture
def user(client: TestClient) -> dict[str, str]:
    return bearer(sign_in(client)["access_token"])


@pytest.fixture
def other_user(client: TestClient) -> dict[str, str]:
    return bearer(sign_in(client, email="ravi@example.com")["access_token"])


def create(client: TestClient, headers: dict[str, str], **overrides: Any) -> dict[str, Any]:
    response = client.post(ADDRESSES, json=address_body(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def defaults(client: TestClient, headers: dict[str, str]) -> list[str]:
    return [a["id"] for a in client.get(ADDRESSES, headers=headers).json() if a["is_default"]]


class TestDefaultAddress:
    def test_first_address_becomes_default(self, client: TestClient, user: dict[str, str]) -> None:
        first = create(client, user)
        second = create(client, user, label="Work")
        assert first["is_default"] is True
        assert second["is_default"] is False
        assert defaults(client, user) == [first["id"]]

    def test_creating_with_is_default_moves_the_default(
        self, client: TestClient, user: dict[str, str]
    ) -> None:
        create(client, user)
        work = create(client, user, label="Work", is_default=True)
        assert defaults(client, user) == [work["id"]]

    def test_set_default_keeps_exactly_one(self, client: TestClient, user: dict[str, str]) -> None:
        home = create(client, user)
        work = create(client, user, label="Work")
        response = client.post(f"{ADDRESSES}/{work['id']}/default", headers=user)
        assert response.status_code == 200 and response.json()["is_default"] is True
        assert defaults(client, user) == [work["id"]]
        # Setting it again changes nothing.
        client.post(f"{ADDRESSES}/{work['id']}/default", headers=user)
        assert defaults(client, user) == [work["id"]]
        assert home["id"] not in defaults(client, user)

    def test_default_is_listed_first(self, client: TestClient, user: dict[str, str]) -> None:
        home = create(client, user)
        create(client, user, label="Work")
        create(client, user, label="Parents")
        assert client.get(ADDRESSES, headers=user).json()[0]["id"] == home["id"]

    def test_deleting_default_promotes_most_recently_used(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        home = create(client, user)
        work = create(client, user, label="Work")
        create(client, user, label="Parents")  # newest, but never used
        db_session.get(Address, work["id"]).last_used_at = func.now()
        db_session.commit()

        assert client.delete(f"{ADDRESSES}/{home['id']}", headers=user).status_code == 204
        assert defaults(client, user) == [work["id"]]

    def test_deleting_default_falls_back_to_newest(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        home = create(client, user)
        work = create(client, user, label="Work")
        parents = create(client, user, label="Parents")
        # Tests run in one transaction, where now() never moves; spread the creation times.
        for days_ago, row in ((2, work), (1, parents)):
            db_session.get(Address, row["id"]).created_at = func.now() - timedelta(days=days_ago)
        db_session.commit()

        client.delete(f"{ADDRESSES}/{home['id']}", headers=user)
        assert defaults(client, user) == [parents["id"]]

    def test_deleting_the_last_address_leaves_none(
        self, client: TestClient, user: dict[str, str]
    ) -> None:
        home = create(client, user)
        client.delete(f"{ADDRESSES}/{home['id']}", headers=user)
        assert client.get(ADDRESSES, headers=user).json() == []

    def test_database_rejects_two_defaults(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        create(client, user)
        work = db_session.get(Address, create(client, user, label="Work")["id"])
        work.is_default = True
        with pytest.raises(IntegrityError):
            db_session.flush()
        db_session.rollback()


class TestOwnership:
    def test_other_users_address_is_not_found(
        self, client: TestClient, user: dict[str, str], other_user: dict[str, str]
    ) -> None:
        mine = create(client, user)
        url = f"{ADDRESSES}/{mine['id']}"
        assert client.patch(url, json={"label": "X"}, headers=other_user).status_code == 404
        assert client.delete(url, headers=other_user).status_code == 404
        assert client.post(f"{url}/default", headers=other_user).status_code == 404
        assert client.get(ADDRESSES, headers=other_user).json() == []
        # Untouched for the owner.
        assert client.get(ADDRESSES, headers=user).json()[0]["label"] == "Home"

    def test_requires_sign_in(self, client: TestClient) -> None:
        assert client.get(ADDRESSES).status_code == 401
        assert client.post(ADDRESSES, json=address_body()).status_code == 401


class TestValidation:
    @pytest.mark.parametrize(
        "overrides",
        [
            {"pincode": "24800"},
            {"pincode": "048001"},
            {"pincode": "24800a"},
            {"phone": "12345"},
            {"phone": "5876543210"},  # Indian mobiles start with 6-9
            {"recipient_name": "  "},
            {"line1": ""},
            {"city": "x" * 61},
        ],
    )
    def test_rejects_bad_fields(
        self, client: TestClient, user: dict[str, str], overrides: dict[str, str]
    ) -> None:
        response = client.post(ADDRESSES, json=address_body(**overrides), headers=user)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_blank_optional_fields_become_null(
        self, client: TestClient, user: dict[str, str]
    ) -> None:
        address = create(client, user, line2="  ", landmark="")
        assert address["line2"] is None and address["landmark"] is None

    def test_patch_changes_only_sent_fields_and_can_clear_optionals(
        self, client: TestClient, user: dict[str, str]
    ) -> None:
        home = create(client, user)
        response = client.patch(
            f"{ADDRESSES}/{home['id']}",
            json={"line2": None, "landmark": "", "city": "Rishikesh", "label": None},
            headers=user,
        )
        body = response.json()
        assert response.status_code == 200
        assert (body["line2"], body["landmark"], body["city"]) == (None, None, "Rishikesh")
        assert body["label"] == "Home" and body["line1"] == home["line1"]

    def test_limit_per_user(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        for i in range(MAX_ADDRESSES_PER_USER):
            create(client, user, label=f"Place {i}")
        response = client.post(ADDRESSES, json=address_body(), headers=user)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "ADDRESS_LIMIT"
        count = db_session.scalar(select(func.count()).select_from(Address))
        assert count == MAX_ADDRESSES_PER_USER


class TestServiceability:
    def test_flag_follows_shop_pincodes(
        self, client: TestClient, user: dict[str, str], db_session: Session
    ) -> None:
        db_session.get(ShopSettings, 1).serviceable_pincodes = ["248001"]
        db_session.commit()
        inside = create(client, user)
        outside = create(client, user, pincode="110001")
        assert inside["is_serviceable"] is True
        # Unserviceable addresses are still saved, just flagged.
        assert outside["is_serviceable"] is False

    def test_empty_list_accepts_all_only_in_local_and_test(self) -> None:
        shop = ShopSettings(serviceable_pincodes=[])
        assert DeliveryArea.from_settings(shop, "local").covers("110001")
        assert DeliveryArea.from_settings(shop, "test").covers("110001")
        assert not DeliveryArea.from_settings(shop, "staging").covers("110001")
        assert not DeliveryArea.from_settings(shop, "production").covers("110001")

    def test_list_restricts_in_every_environment(self) -> None:
        shop = ShopSettings(serviceable_pincodes=["248001"])
        for env in ("local", "production"):
            area = DeliveryArea.from_settings(shop, env)
            assert area.covers("248001") and not area.covers("248002")


@pytest.mark.parametrize(
    ("paise", "text"),
    [(9900, "₹99"), (2050, "₹20.50"), (123456, "₹1,234.56"), (12345600, "₹1,23,456"), (0, "₹0")],
)
def test_format_rupees(paise: int, text: str) -> None:
    assert format_rupees(paise) == text
