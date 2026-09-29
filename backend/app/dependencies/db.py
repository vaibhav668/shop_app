from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.core.database import SessionLocal


def get_db() -> Iterator[Session]:
    """One session per request. Services own their transactions; this only guarantees cleanup."""
    with SessionLocal() as session:
        yield session
