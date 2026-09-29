import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.repositories import users as repo
from tests.helpers import bearer, sign_in

ME = "/api/v1/me"


@pytest.fixture
def headers(client: TestClient) -> dict[str, str]:
    return bearer(sign_in(client)["access_token"])


def test_onboarding_sets_name_and_phone(client: TestClient, headers: dict[str, str]) -> None:
    response = client.patch(
        ME, json={"name": "  Asha Rao ", "phone": "9876543210"}, headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Asha Rao"
    assert body["phone"] == "9876543210"
    assert body["needs_onboarding"] is False


@pytest.mark.parametrize("phone", ["12345", "5876543210", "98765432101", "98765abcde"])
def test_rejects_invalid_phone(client: TestClient, headers: dict[str, str], phone: str) -> None:
    response = client.patch(ME, json={"phone": phone}, headers=headers)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_rejects_blank_name(client: TestClient, headers: dict[str, str]) -> None:
    assert client.patch(ME, json={"name": "   "}, headers=headers).status_code == 400


def test_device_registration_is_idempotent(
    client: TestClient, headers: dict[str, str], db_session: Session
) -> None:
    for _ in range(2):
        response = client.post(f"{ME}/devices", json={"token": "fcm-token-abcdef"}, headers=headers)
        assert response.status_code == 204
    assert repo.get_device_token(db_session, "fcm-token-abcdef") is not None

    client.delete(f"{ME}/devices/fcm-token-abcdef", headers=headers)
    assert repo.get_device_token(db_session, "fcm-token-abcdef") is None


def test_device_moves_to_new_owner(client: TestClient, db_session: Session) -> None:
    first = bearer(sign_in(client, "one@example.com")["access_token"])
    second = bearer(sign_in(client, "two@example.com")["access_token"])
    client.post(f"{ME}/devices", json={"token": "shared-phone-token"}, headers=first)
    client.post(f"{ME}/devices", json={"token": "shared-phone-token"}, headers=second)

    device = repo.get_device_token(db_session, "shared-phone-token")
    two = repo.get_user_by_email(db_session, "two@example.com")
    assert device is not None and two is not None
    assert device.user_id == two.id


def test_delete_account_anonymises_and_signs_out(client: TestClient, db_session: Session) -> None:
    body = sign_in(client)
    headers = bearer(body["access_token"])
    client.patch(ME, json={"phone": "9876543210"}, headers=headers)

    assert client.delete(ME, headers=headers).status_code == 204

    assert client.get(ME, headers=headers).status_code == 401
    user = repo.get_user(db_session, body["user"]["id"])
    assert user is not None
    assert user.email.endswith("@deleted.invalid")
    assert user.phone is None
    assert user.deleted_at is not None
    assert repo.get_user_by_email(db_session, "asha@example.com") is None

    # The same Google account can start fresh afterwards.
    again = sign_in(client)
    assert again["is_new_user"] is True
    assert again["user"]["id"] != body["user"]["id"]
