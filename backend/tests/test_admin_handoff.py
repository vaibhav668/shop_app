"""Single sign-in page: an admin who signs in on the shop is handed into the admin dashboard
with a one-time code, without signing in twice."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models import AuthHandoff
from tests.helpers import bearer, promote, sign_in

HANDOFF = "/api/v1/auth/admin-handoff"


@pytest.fixture
def admin_on_shop(client: TestClient, db_session: Session) -> dict[str, str]:
    """An admin signed in through the shop's (mobile/web) sign-in page."""
    sign_in(client, email="owner@example.com")
    promote(db_session, "owner@example.com")
    return bearer(sign_in(client, email="owner@example.com", kind="mobile")["access_token"])


def redeem(client: TestClient, code: str):
    return client.post(f"{HANDOFF}/redeem", json={"code": code})


def test_admin_moves_from_the_shop_into_the_dashboard(
    client: TestClient, admin_on_shop: dict[str, str]
) -> None:
    created = client.post(HANDOFF, headers=admin_on_shop)
    assert created.status_code == 200
    code = created.json()["code"]
    assert created.json()["expires_in"] == 60

    response = redeem(client, code)
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "ADMIN"
    assert "refresh_token" not in body  # the admin gets it as an httpOnly cookie
    assert "bb_refresh" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]

    # The new admin session works on admin endpoints.
    admin = bearer(body["access_token"])
    assert client.get("/api/v1/admin/orders/summary", headers=admin).status_code == 200


def test_the_shop_session_ends(client: TestClient, admin_on_shop: dict[str, str]) -> None:
    client.post(HANDOFF, headers=admin_on_shop)
    # So signing out of the admin lands on a clean sign-in page, not straight back in.
    assert client.get("/api/v1/me", headers=admin_on_shop).status_code == 401


def test_a_code_works_only_once(client: TestClient, admin_on_shop: dict[str, str]) -> None:
    code = client.post(HANDOFF, headers=admin_on_shop).json()["code"]
    assert redeem(client, code).status_code == 200
    again = redeem(client, code)
    assert again.status_code == 401
    assert again.json()["error"]["code"] == "HANDOFF_INVALID"


def test_an_expired_code_is_refused(
    client: TestClient, admin_on_shop: dict[str, str], db_session: Session
) -> None:
    code = client.post(HANDOFF, headers=admin_on_shop).json()["code"]
    handoff = db_session.scalars(select(AuthHandoff)).one()
    handoff.expires_at = utcnow() - timedelta(seconds=1)
    db_session.commit()
    assert redeem(client, code).status_code == 401


def test_only_the_hash_is_stored(
    client: TestClient, admin_on_shop: dict[str, str], db_session: Session
) -> None:
    code = client.post(HANDOFF, headers=admin_on_shop).json()["code"]
    assert db_session.scalars(select(AuthHandoff.code_hash)).one() != code


def test_customers_cannot_get_a_code(client: TestClient) -> None:
    customer = bearer(sign_in(client)["access_token"])
    response = client.post(HANDOFF, headers=customer)
    assert response.status_code == 403
    # ...and their shop session is untouched.
    assert client.get("/api/v1/me", headers=customer).status_code == 200


def test_unknown_codes_and_signed_out_callers_are_refused(client: TestClient) -> None:
    assert redeem(client, "x" * 43).status_code == 401
    assert client.post(HANDOFF).status_code == 401


def test_a_code_stops_working_if_admin_rights_are_removed(
    client: TestClient, admin_on_shop: dict[str, str], db_session: Session
) -> None:
    code = client.post(HANDOFF, headers=admin_on_shop).json()["code"]
    handoff = db_session.scalars(select(AuthHandoff)).one()
    handoff.user.role = handoff.user.role.CUSTOMER
    db_session.commit()
    assert redeem(client, code).status_code == 403
