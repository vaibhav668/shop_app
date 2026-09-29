"""ADMIN_EMAILS: named Google accounts become admins on sign-in, with no CLI step."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import UserRole
from app.repositories import users as repo
from tests.fakes import google_token
from tests.helpers import sign_in


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    # Overrides the conftest fixture for this module: the app is built with an admin list.
    return Settings(
        app_env="test",
        dev_login_enabled=True,
        google_allowed_client_ids="test-web-client",
        admin_emails=" Owner@Example.com , partner@example.com",
        media_dir=tmp_path / "media",
    )


def role(db: Session, email: str) -> UserRole:
    user = repo.get_user_by_email(db, email)
    assert user is not None
    return user.role


def test_listed_email_can_open_the_admin_on_first_sign_in(
    client: TestClient, db_session: Session
) -> None:
    body = sign_in(client, "owner@example.com", kind="admin")  # refused if not an admin
    assert body["user"]["role"] == "ADMIN"
    assert role(db_session, "owner@example.com") is UserRole.ADMIN


def test_the_list_ignores_case_and_spaces(client: TestClient, db_session: Session) -> None:
    sign_in(client, "PARTNER@example.com")
    assert role(db_session, "partner@example.com") is UserRole.ADMIN


def test_other_accounts_stay_customers(client: TestClient, db_session: Session) -> None:
    sign_in(client, "asha@example.com")
    assert role(db_session, "asha@example.com") is UserRole.CUSTOMER
    response = client.post(
        "/api/v1/auth/google",
        json={"id_token": google_token("asha@example.com"), "client": "admin"},
    )
    assert response.status_code == 403


def test_dev_login_cannot_claim_a_listed_email(client: TestClient, db_session: Session) -> None:
    response = client.post(
        "/api/v1/auth/dev-login", json={"email": "owner@example.com", "client": "mobile"}
    )
    assert response.status_code == 200
    assert role(db_session, "owner@example.com") is UserRole.CUSTOMER
