from sqlalchemy import text
from sqlalchemy.orm import Session


def test_required_extensions_installed(db_session: Session) -> None:
    installed = set(db_session.scalars(text("SELECT extname FROM pg_extension")))
    assert {"pg_trgm", "citext"} <= installed
