from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import AccessClaims, decode_access_token
from app.dependencies.db import get_db
from app.integrations.google_auth import GoogleIdTokenVerifier, GoogleVerifier
from app.models import User, UserRole
from app.repositories import users as repo

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentSession:
    user: User
    claims: AccessClaims


def _unauthenticated() -> AppError:
    return AppError("UNAUTHENTICATED", "Please sign in.", status_code=401)


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CurrentSession:
    if credentials is None:
        raise _unauthenticated()
    claims = decode_access_token(settings, credentials.credentials)

    # Checked on every request so sign-out, bans and role changes apply immediately.
    session = repo.get_session(db, claims.session_id)
    if session is None or session.revoked_at is not None or session.user_id != claims.user_id:
        raise _unauthenticated()
    user = repo.get_user(db, claims.user_id)
    if user is None:
        raise _unauthenticated()
    if not user.is_active or user.deleted_at is not None:
        raise AppError("ACCOUNT_DISABLED", "This account is disabled.", status_code=403)
    return CurrentSession(user=user, claims=claims)


def get_current_user(current: CurrentSession = Depends(get_current_session)) -> User:
    return current.user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role is not UserRole.ADMIN:
        raise AppError("FORBIDDEN", "Admins only.", status_code=403)
    return user


def get_google_verifier(settings: Settings = Depends(get_settings)) -> GoogleVerifier:
    return GoogleIdTokenVerifier(settings.google_client_id_list)
