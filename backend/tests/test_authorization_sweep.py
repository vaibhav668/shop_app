"""Every admin route refuses anonymous callers (401) and customers (403).

Routes are discovered from the app itself, so a new admin endpoint is covered automatically.
"""

import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import bearer, sign_in


def admin_routes() -> list[tuple[str, str]]:
    # The OpenAPI document lists every mounted route with its full path and methods.
    paths = create_app().openapi()["paths"]
    found = []
    for path, operations in paths.items():
        if not path.startswith("/api/v1/admin"):
            continue
        # Fill path parameters with a well-formed id; auth must fail before any lookup.
        concrete = re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)
        for method in operations:
            found.append((method.upper(), concrete))
    return sorted(found)


ADMIN_ROUTES = admin_routes()


def test_there_are_admin_routes_to_check() -> None:
    assert len(ADMIN_ROUTES) > 20


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_routes_need_an_admin(client: TestClient, method: str, path: str) -> None:
    anonymous = client.request(method, path, json={})
    assert anonymous.status_code == 401, f"{method} {path} answered {anonymous.status_code}"

    customer = bearer(sign_in(client, email="sweep@example.com")["access_token"])
    as_customer = client.request(method, path, json={}, headers=customer)
    assert as_customer.status_code == 403, f"{method} {path} answered {as_customer.status_code}"


# Everything personal: a signed-out caller gets 401 on every route under these prefixes.
PRIVATE_PREFIXES = (
    "/api/v1/me",
    "/api/v1/cart",
    "/api/v1/favourites",
    "/api/v1/addresses",
    "/api/v1/checkout",
    "/api/v1/orders",
    "/api/v1/notifications",
)


def private_routes() -> list[tuple[str, str]]:
    paths = create_app().openapi()["paths"]
    found = []
    for path, operations in paths.items():
        if path.startswith(PRIVATE_PREFIXES):
            concrete = re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)
            found.extend((method.upper(), concrete) for method in operations)
    return sorted(found)


@pytest.mark.parametrize(("method", "path"), private_routes())
def test_personal_routes_need_sign_in(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={})
    assert response.status_code == 401, f"{method} {path} answered {response.status_code}"
