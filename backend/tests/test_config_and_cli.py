import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.cli import set_role
from app.core.config import Settings
from app.main import create_app
from app.models import UserRole
from app.repositories import users as repo
from tests.helpers import sign_in

STRONG_SECRET = "s" * 48
CLOUD = {
    "storage_provider": "cloudinary",
    "cloudinary_url": "cloudinary://k:s@demo",
    "push_provider": "fcm",
    "firebase_credentials_file": "firebase-service-account.json",
}


def test_production_requires_real_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(app_env="production")


def test_production_rejects_dev_login() -> None:
    with pytest.raises(ValidationError, match="DEV_LOGIN_ENABLED"):
        Settings(app_env="production", jwt_secret=STRONG_SECRET, dev_login_enabled=True, **CLOUD)


def test_dev_login_route_absent_when_disabled() -> None:
    app = create_app(Settings(app_env="local", dev_login_enabled=False))
    response = TestClient(app).post("/api/v1/auth/dev-login", json={"email": "a@b.co"})
    assert response.status_code == 404


def test_production_hides_api_docs() -> None:
    app = create_app(Settings(app_env="production", jwt_secret=STRONG_SECRET, **CLOUD))
    assert TestClient(app).get("/docs").status_code == 404


def test_make_admin_cli(client: TestClient, db_session: Session) -> None:
    sign_in(client, "Owner@Example.com")
    assert set_role(db_session, " owner@example.com ", UserRole.ADMIN).endswith("ADMIN.")
    user = repo.get_user_by_email(db_session, "owner@example.com")
    assert user is not None and user.role is UserRole.ADMIN


def test_make_admin_requires_existing_user(db_session: Session) -> None:
    with pytest.raises(LookupError, match="must sign in once"):
        set_role(db_session, "nobody@example.com", UserRole.ADMIN)


def test_production_rejects_local_image_storage() -> None:
    with pytest.raises(ValidationError, match="cloud image storage"):
        Settings(app_env="production", jwt_secret=STRONG_SECRET)


def test_production_rejects_fake_push() -> None:
    cloud_storage = {k: v for k, v in CLOUD.items() if not k.startswith(("push", "firebase"))}
    with pytest.raises(ValidationError, match="PUSH_PROVIDER=fcm"):
        Settings(app_env="production", jwt_secret=STRONG_SECRET, **cloud_storage)


def test_fcm_needs_a_credentials_file() -> None:
    with pytest.raises(ValidationError, match="FIREBASE_CREDENTIALS_FILE"):
        Settings(app_env="local", push_provider="fcm")
