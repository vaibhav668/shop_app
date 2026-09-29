from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_access_token, utcnow
from app.repositories import users as repo
from tests.fakes import google_token
from tests.helpers import bearer, promote, sign_in

AUTH = "/api/v1/auth"


class TestGoogleSignIn:
    def test_first_sign_in_creates_customer(self, client: TestClient) -> None:
        body = sign_in(client, "asha@example.com")

        assert body["is_new_user"] is True
        assert body["token_type"] == "bearer"
        assert body["refresh_token"]
        assert body["user"]["email"] == "asha@example.com"
        assert body["user"]["role"] == "CUSTOMER"
        assert body["user"]["needs_onboarding"] is True

    def test_returning_user_is_not_new(self, client: TestClient) -> None:
        first = sign_in(client, "asha@example.com")
        second = sign_in(client, "asha@example.com")
        assert second["is_new_user"] is False
        assert second["user"]["id"] == first["user"]["id"]

    def test_forged_token_rejected(self, client: TestClient) -> None:
        response = client.post(f"{AUTH}/google", json={"id_token": "x" * 40})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_GOOGLE_TOKEN"

    def test_access_token_opens_me(self, client: TestClient) -> None:
        body = sign_in(client)
        response = client.get("/api/v1/me", headers=bearer(body["access_token"]))
        assert response.status_code == 200
        assert response.json()["email"] == "asha@example.com"


class TestAdminSignIn:
    def test_customer_cannot_sign_in_to_admin(self, client: TestClient) -> None:
        sign_in(client, "asha@example.com")
        response = client.post(
            f"{AUTH}/google",
            json={"id_token": google_token("asha@example.com"), "client": "admin"},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    def test_admin_gets_cookie_not_body_token(
        self, client: TestClient, db_session: Session
    ) -> None:
        sign_in(client, "owner@example.com")
        promote(db_session, "owner@example.com")

        response = client.post(
            f"{AUTH}/google",
            json={"id_token": google_token("owner@example.com"), "client": "admin"},
        )
        assert response.status_code == 200
        assert "refresh_token" not in response.json()
        cookie = response.headers["set-cookie"]
        assert "db_refresh=" in cookie
        assert "HttpOnly" in cookie
        assert "Path=/api/v1/auth" in cookie
        assert "SameSite=strict" in cookie

    def test_admin_refreshes_with_cookie(self, client: TestClient, db_session: Session) -> None:
        sign_in(client, "owner@example.com")
        promote(db_session, "owner@example.com")
        client.post(
            f"{AUTH}/google",
            json={"id_token": google_token("owner@example.com"), "client": "admin"},
        )
        # TestClient keeps the cookie jar, like a browser.
        response = client.post(f"{AUTH}/refresh")
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "ADMIN"


class TestRefresh:
    def test_rotates_refresh_token(self, client: TestClient) -> None:
        first = sign_in(client)
        response = client.post(f"{AUTH}/refresh", json={"refresh_token": first["refresh_token"]})
        assert response.status_code == 200
        rotated = response.json()
        assert rotated["refresh_token"] != first["refresh_token"]
        assert client.get("/api/v1/me", headers=bearer(rotated["access_token"])).status_code == 200

    def test_reusing_old_token_revokes_session(self, client: TestClient) -> None:
        first = sign_in(client)
        rotated = client.post(
            f"{AUTH}/refresh", json={"refresh_token": first["refresh_token"]}
        ).json()

        replay = client.post(f"{AUTH}/refresh", json={"refresh_token": first["refresh_token"]})
        assert replay.status_code == 401

        # The legitimate holder is signed out too: the family is compromised.
        after = client.post(f"{AUTH}/refresh", json={"refresh_token": rotated["refresh_token"]})
        assert after.status_code == 401
        assert client.get("/api/v1/me", headers=bearer(rotated["access_token"])).status_code == 401

    def test_unknown_token_rejected(self, client: TestClient) -> None:
        response = client.post(f"{AUTH}/refresh", json={"refresh_token": "nope"})
        assert response.status_code == 401

    def test_missing_token_rejected(self, client: TestClient) -> None:
        assert client.post(f"{AUTH}/refresh").status_code == 401


class TestAccessToken:
    def test_missing_token(self, client: TestClient) -> None:
        response = client.get("/api/v1/me")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHENTICATED"

    def test_expired_token(self, client: TestClient, test_settings: Settings) -> None:
        body = sign_in(client)
        me = client.get("/api/v1/me", headers=bearer(body["access_token"])).json()
        session_id = _session_id_from(body["access_token"], test_settings)
        expired, _ = create_access_token(
            test_settings,
            user_id=me["id"],
            session_id=session_id,
            role="CUSTOMER",
            now=utcnow() - timedelta(hours=1),
        )
        response = client.get("/api/v1/me", headers=bearer(expired))
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "TOKEN_EXPIRED"

    def test_token_signed_with_other_secret(self, client: TestClient) -> None:
        body = sign_in(client)
        other = Settings(app_env="test", jwt_secret="another-secret-that-is-long-enough-123")
        session_id = _session_id_from(body["access_token"], Settings(app_env="test"))
        forged, _ = create_access_token(
            other, user_id=body["user"]["id"], session_id=session_id, role="ADMIN"
        )
        assert client.get("/api/v1/me", headers=bearer(forged)).status_code == 401


class TestLogout:
    def test_logout_ends_session(self, client: TestClient) -> None:
        body = sign_in(client)
        headers = bearer(body["access_token"])
        assert client.post(f"{AUTH}/logout", headers=headers).status_code == 204
        assert client.get("/api/v1/me", headers=headers).status_code == 401
        refresh = client.post(f"{AUTH}/refresh", json={"refresh_token": body["refresh_token"]})
        assert refresh.status_code == 401

    def test_logout_removes_device_token(self, client: TestClient, db_session: Session) -> None:
        body = sign_in(client)
        headers = bearer(body["access_token"])
        client.post("/api/v1/me/devices", json={"token": "fcm-token-123456"}, headers=headers)
        client.post(f"{AUTH}/logout", json={"device_token": "fcm-token-123456"}, headers=headers)
        assert repo.get_device_token(db_session, "fcm-token-123456") is None


class TestDisabledAccount:
    def test_disabled_user_is_locked_out(self, client: TestClient, db_session: Session) -> None:
        body = sign_in(client)
        user = repo.get_user_by_email(db_session, "asha@example.com")
        assert user is not None
        user.is_active = False
        db_session.commit()

        me = client.get("/api/v1/me", headers=bearer(body["access_token"]))
        assert me.status_code == 403
        assert me.json()["error"]["code"] == "ACCOUNT_DISABLED"
        again = client.post(f"{AUTH}/google", json={"id_token": google_token("asha@example.com")})
        assert again.status_code == 403


class TestDevLogin:
    def test_dev_login_works_when_enabled(self, client: TestClient) -> None:
        response = client.post(f"{AUTH}/dev-login", json={"email": "dev@example.com"})
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "dev@example.com"


def _session_id_from(token: str, settings: Settings):
    from app.core.security import decode_access_token

    return decode_access_token(settings, token).session_id
