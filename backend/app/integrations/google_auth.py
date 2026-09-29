"""Verifies Google ID tokens server-side. Nothing the client says about identity is trusted."""

from dataclasses import dataclass
from typing import Protocol

from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.errors import AppError

_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str
    picture: str | None


class GoogleVerifier(Protocol):
    def verify(self, token: str) -> GoogleIdentity: ...


def _invalid() -> AppError:
    return AppError("INVALID_GOOGLE_TOKEN", "Google sign-in could not be verified.", 401)


class GoogleIdTokenVerifier:
    def __init__(self, allowed_client_ids: list[str]) -> None:
        self._allowed = set(allowed_client_ids)
        self._request = google_requests.Request()

    def verify(self, token: str) -> GoogleIdentity:
        if not self._allowed:
            raise AppError(
                "GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured on the server.", 503
            )
        try:
            # Checks signature (Google's public keys), expiry and issuer.
            claims = google_id_token.verify_oauth2_token(
                token, self._request, clock_skew_in_seconds=10
            )
        except google_exceptions.TransportError as exc:
            raise AppError("GOOGLE_UNAVAILABLE", "Couldn't reach Google. Try again.", 503) from exc
        except ValueError as exc:
            raise _invalid() from exc

        if claims.get("iss") not in _GOOGLE_ISSUERS or claims.get("aud") not in self._allowed:
            raise _invalid()
        if not claims.get("email") or claims.get("email_verified") is not True:
            raise _invalid()

        return GoogleIdentity(
            sub=str(claims["sub"]),
            email=str(claims["email"]).lower(),
            name=str(claims.get("name") or claims["email"].split("@")[0]),
            picture=claims.get("picture"),
        )
