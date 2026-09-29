import os

os.environ["APP_ENV"] = "test"

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.dependencies.auth import get_google_verifier
from app.dependencies.db import get_db
from app.main import create_app
from tests.fakes import FakeGoogleVerifier

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def db_engine() -> Iterator[Engine]:
    """Real PostgreSQL test database, migrated to head once per test run."""
    url = get_settings().test_database_url
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError as exc:
        pytest.fail(
            "Test database is not reachable. Create it once with "
            "backend/scripts/create_local_db.sql (see README).\n"
            f"{exc.orig}",
            pytrace=False,
        )

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine: Engine) -> Iterator[Session]:
    """A session whose work is rolled back after each test, including any commits it makes."""
    connection = db_engine.connect()
    outer = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        app_env="test",
        dev_login_enabled=True,
        google_allowed_client_ids="test-web-client",
        access_token_ttl_minutes=15,
    )


@pytest.fixture
def client(db_session: Session, test_settings: Settings) -> Iterator[TestClient]:
    app = create_app(test_settings)
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_google_verifier] = lambda: FakeGoogleVerifier()
    with TestClient(app) as test_client:
        yield test_client
