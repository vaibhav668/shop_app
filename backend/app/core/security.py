"""Access tokens (short-lived JWTs) and refresh tokens (random, stored only as hashes)."""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import Settings
from app.core.errors import AppError

_ALGORITHM = "HS256"
_ISSUER = "daily-basket-api"


@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID
    role: str


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    settings: Settings,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    role: str,
    now: datetime | None = None,
) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    issued = now or utcnow()
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "iss": _ISSUER,
        "sub": str(user_id),
        "sid": str(session_id),
        "role": role,
        "typ": "access",
        "iat": issued,
        "exp": issued + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM), int(ttl.total_seconds())


def decode_access_token(settings: Settings, token: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[_ALGORITHM],
            issuer=_ISSUER,
            options={"require": ["exp", "iat", "sub", "sid", "typ"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AppError("TOKEN_EXPIRED", "Your session has expired.", status_code=401) from exc
    except jwt.InvalidTokenError as exc:
        raise AppError("UNAUTHENTICATED", "Please sign in.", status_code=401) from exc

    if payload.get("typ") != "access":
        raise AppError("UNAUTHENTICATED", "Please sign in.", status_code=401)
    try:
        return AccessClaims(
            user_id=uuid.UUID(payload["sub"]),
            session_id=uuid.UUID(payload["sid"]),
            role=str(payload.get("role", "")),
        )
    except ValueError as exc:
        raise AppError("UNAUTHENTICATED", "Please sign in.", status_code=401) from exc


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
