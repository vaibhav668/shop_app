"""Admin authorization is enforced by the backend, never only by the admin UI."""

import re

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.dependencies.auth import get_google_verifier, require_admin
from app.dependencies.db import get_db
from app.main import create_app
from app.models import User
from tests.fakes import FakeGoogleVerifier
from tests.helpers import bearer, promote, sign_in


@pytest.fixture
def probe_client(db_session: Session, test_settings: Settings) -> TestClient:
    """The real app plus one probe route guarded exactly like the admin router."""
    app = create_app(test_settings)
    probe = APIRouter()

    @probe.get("/api/v1/_probe/admin")
    def admin_only(user: User = Depends(require_admin)) -> dict[str, str]:
        return {"email": user.email}

    app.include_router(probe)
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_google_verifier] = lambda: FakeGoogleVerifier()
    return TestClient(app)


def test_customer_is_forbidden(probe_client: TestClient) -> None:
    token = sign_in(probe_client, "asha@example.com")["access_token"]
    response = probe_client.get("/api/v1/_probe/admin", headers=bearer(token))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_admin_is_allowed(probe_client: TestClient, db_session: Session) -> None:
    token = sign_in(probe_client, "owner@example.com")["access_token"]
    promote(db_session, "owner@example.com")
    response = probe_client.get("/api/v1/_probe/admin", headers=bearer(token))
    assert response.status_code == 200


def test_anonymous_is_unauthenticated(probe_client: TestClient) -> None:
    assert probe_client.get("/api/v1/_probe/admin").status_code == 401


def _admin_routes() -> list[tuple[str, str]]:
    # Read from the OpenAPI spec: included routers are not flattened into app.routes.
    spec = create_app(Settings(app_env="test")).openapi()
    return [
        (method.upper(), path)
        for path, operations in spec["paths"].items()
        if path.startswith("/api/v1/admin")
        for method in operations
    ]


ADMIN_ROUTES = _admin_routes()


def test_admin_route_sweep_is_not_empty() -> None:
    """If route discovery breaks, fail here instead of the sweep passing vacuously."""
    assert len(ADMIN_ROUTES) >= 10


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_every_admin_route_rejects_customers(client: TestClient, method: str, path: str) -> None:
    """Grows automatically as admin routes are added in later phases."""
    token = sign_in(client, "asha@example.com")["access_token"]
    concrete = re.sub(r"\{[^}]+\}", "00000000-0000-0000-0000-000000000000", path)
    response = client.request(method, concrete, headers=bearer(token))
    assert response.status_code == 403, f"{method} {path} is not admin-protected"
