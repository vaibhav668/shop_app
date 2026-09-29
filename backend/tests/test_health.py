from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.main import create_app


def test_liveness_needs_no_database() -> None:
    response = TestClient(create_app()).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_health_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_health_reports_unreachable_database() -> None:
    dead_engine = create_engine(
        "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none?connect_timeout=1"
    )

    def dead_db() -> Iterator[Session]:
        with Session(dead_engine) as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_db] = dead_db
    response = TestClient(app).get("/api/v1/health/db")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DB_UNAVAILABLE"
