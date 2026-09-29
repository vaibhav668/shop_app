"""Every failure must come back in the one documented error shape."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import AppError, register_error_handlers
from app.main import create_app


@pytest.fixture
def error_client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/items/{item_id}")
    def get_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    @app.get("/out-of-stock")
    def out_of_stock() -> None:
        raise AppError("OUT_OF_STOCK", "Only 2 left.", status_code=409, details={"available": 2})

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    return TestClient(app, raise_server_exceptions=False)


def test_app_error_shape(error_client: TestClient) -> None:
    response = error_client.get("/out-of-stock")
    assert response.status_code == 409
    assert response.json() == {
        "error": {"code": "OUT_OF_STOCK", "message": "Only 2 left.", "details": {"available": 2}}
    }


def test_validation_error_is_400_with_field_list(error_client: TestClient) -> None:
    response = error_client.get("/items/not-a-number")
    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"]["fields"][0]["loc"] == "path.item_id"


def test_unexpected_error_hides_internals(error_client: TestClient) -> None:
    response = error_client.get("/boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secret" not in response.text


def test_unknown_route_is_not_found() -> None:
    response = TestClient(create_app()).get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
