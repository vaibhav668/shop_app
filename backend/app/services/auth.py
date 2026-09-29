"""Sign-in, token refresh and sign-out. Owns the auth transactions."""

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import create_access_token, hash_token, new_refresh_token, utcnow
from app.integrations.google_auth import GoogleIdentity
from app.models import AuthHandoff, SessionClient, User, UserRole, UserSession
from app.repositories import users as repo


@dataclass(frozen=True)
class AuthResult:
    user: User
    access_token: str
    expires_in: int
    refresh_token: str
    is_new_user: bool
    client: SessionClient


# Prefix of google_sub for accounts created by the local-only dev login.
DEV_SUB_PREFIX = "dev:"
# The shop → admin dashboard pass is used immediately by the browser; a minute is plenty.
HANDOFF_TTL_SECONDS = 60


def _session_expired() -> AppError:
    return AppError("UNAUTHENTICATED", "Your session has ended. Please sign in again.", 401)


class AuthService:
    def __init__(self, db: Session, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def sign_in(
        self, identity: GoogleIdentity, client: SessionClient, user_agent: str | None
    ) -> AuthResult:
        user, is_new = self._upsert_user(identity)
        self._apply_admin_list(user, identity)
        try:
            self._assert_can_sign_in(user, client)
        except AppError:
            # Keep the account even when this sign-in is refused, so an owner can run
            # `make-admin` for someone who just tried the admin dashboard.
            self.db.commit()
            raise
        user.last_login_at = utcnow()
        return self._issue(user, client, user_agent, is_new_user=is_new)

    def _apply_admin_list(self, user: User, identity: GoogleIdentity) -> None:
        """ADMIN_EMAILS (server config) names the shop's admins, so a fresh database needs no
        `make-admin` step. Only Google-verified sign-ins count (never the local dev login), and
        it only ever promotes: removing an email from the list does not demote anyone."""
        if identity.sub.startswith(DEV_SUB_PREFIX):
            return
        if identity.email.lower() in self.settings.admin_email_list:
            user.role = UserRole.ADMIN

    def refresh(self, raw_refresh_token: str) -> AuthResult:
        token_hash = hash_token(raw_refresh_token)
        session = repo.get_session_by_token_hash(self.db, token_hash, lock=True)

        if session is None:
            reused = repo.get_session_by_previous_hash(self.db, token_hash)
            if reused is not None and reused.revoked_at is None:
                # An already-rotated token came back: assume it leaked and end that session.
                reused.revoked_at = utcnow()
                self.db.commit()
            raise _session_expired()

        now = utcnow()
        if session.revoked_at is not None or session.expires_at <= now:
            raise _session_expired()

        user = session.user
        self._assert_can_sign_in(user, session.client)

        new_token = new_refresh_token()
        session.previous_token_hash = session.refresh_token_hash
        session.refresh_token_hash = hash_token(new_token)
        session.last_used_at = now
        access, expires_in = create_access_token(
            self.settings, user_id=user.id, session_id=session.id, role=user.role.value
        )
        self.db.commit()
        return AuthResult(user, access, expires_in, new_token, False, session.client)

    # --- single sign-in page → admin dashboard ---------------------------------------------

    def create_admin_handoff(self, user: User, session_id: uuid.UUID) -> str:
        """An admin signed in on the shop's sign-in page: give them a one-time code for the
        admin dashboard, and end this shop session (they are moving over, not staying)."""
        if user.role is not UserRole.ADMIN:
            raise AppError("FORBIDDEN", "Admins only.", 403)
        code = new_refresh_token()  # 32 random bytes, URL-safe
        now = utcnow()
        self.db.add(
            AuthHandoff(
                user_id=user.id,
                code_hash=hash_token(code),
                expires_at=now + timedelta(seconds=HANDOFF_TTL_SECONDS),
            )
        )
        session = repo.get_session(self.db, session_id)
        if session is not None and session.user_id == user.id and session.revoked_at is None:
            session.revoked_at = now
        self.db.commit()
        return code

    def redeem_admin_handoff(self, code: str, user_agent: str | None) -> AuthResult:
        handoff = self.db.scalar(
            select(AuthHandoff).where(AuthHandoff.code_hash == hash_token(code)).with_for_update()
        )
        now = utcnow()
        if handoff is None or handoff.used_at is not None or handoff.expires_at <= now:
            raise AppError(
                "HANDOFF_INVALID", "This sign-in link has expired. Please sign in again.", 401
            )
        handoff.used_at = now  # single use, even if the checks below refuse
        user = handoff.user
        try:
            self._assert_can_sign_in(user, SessionClient.ADMIN)
        except AppError:
            self.db.commit()
            raise
        user.last_login_at = now
        return self._issue(user, SessionClient.ADMIN, user_agent, is_new_user=False)

    def sign_out(self, user: User, session_id: uuid.UUID, device_token: str | None) -> None:
        session = repo.get_session(self.db, session_id)
        if session is not None and session.user_id == user.id and session.revoked_at is None:
            session.revoked_at = utcnow()
        if device_token:
            repo.delete_device_token(self.db, user.id, device_token)
        self.db.commit()

    # --- internals -------------------------------------------------------------------------

    def _upsert_user(self, identity: GoogleIdentity) -> tuple[User, bool]:
        user = repo.get_user_by_google_sub(self.db, identity.sub)
        if user is not None:
            user.email = identity.email
            user.avatar_url = identity.picture
            return user, False

        existing = repo.get_user_by_email(self.db, identity.email)
        if existing is not None and self._is_local_dev_account(existing, identity):
            # Local/test only: a dev-login account is claimed by the real Google account.
            existing.google_sub = identity.sub
            existing.avatar_url = identity.picture
            return existing, False
        if existing is not None:
            # Same email, different Google account. Never merge silently.
            raise AppError(
                "ACCOUNT_CONFLICT",
                "This email is linked to a different Google account. Contact the shop.",
                409,
            )
        user = User(
            google_sub=identity.sub,
            email=identity.email,
            name=identity.name,
            avatar_url=identity.picture,
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()
        return user, True

    def _is_local_dev_account(self, user: User, identity: GoogleIdentity) -> bool:
        return (
            self.settings.app_env in ("local", "test")
            and user.google_sub.startswith(DEV_SUB_PREFIX)
            and not identity.sub.startswith(DEV_SUB_PREFIX)
        )

    def _assert_can_sign_in(self, user: User, client: SessionClient) -> None:
        if not user.is_active or user.deleted_at is not None:
            raise AppError("ACCOUNT_DISABLED", "This account is disabled.", 403)
        if client is SessionClient.ADMIN and user.role is not UserRole.ADMIN:
            raise AppError("FORBIDDEN", "This Google account isn't a shop admin.", 403)

    def _issue(
        self, user: User, client: SessionClient, user_agent: str | None, *, is_new_user: bool
    ) -> AuthResult:
        refresh = new_refresh_token()
        now = utcnow()
        session = UserSession(
            user_id=user.id,
            client=client,
            refresh_token_hash=hash_token(refresh),
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            last_used_at=now,
            user_agent=(user_agent or "")[:300] or None,
        )
        self.db.add(session)
        self.db.flush()
        access, expires_in = create_access_token(
            self.settings, user_id=user.id, session_id=session.id, role=user.role.value
        )
        self.db.commit()
        return AuthResult(user, access, expires_in, refresh, is_new_user, client)
