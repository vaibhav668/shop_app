from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import UserRole
from app.repositories import users as repo
from tests.fakes import google_token


def sign_in(client: TestClient, email: str = "asha@example.com", kind: str = "mobile") -> Any:
    response = client.post(
        "/api/v1/auth/google", json={"id_token": google_token(email), "client": kind}
    )
    assert response.status_code == 200, response.text
    return response.json()


def bearer(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def promote(db: Session, email: str) -> None:
    user = repo.get_user_by_email(db, email)
    assert user is not None
    user.role = UserRole.ADMIN
    db.commit()
