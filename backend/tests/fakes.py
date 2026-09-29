from app.core.errors import AppError
from app.integrations.google_auth import GoogleIdentity

TOKEN_PREFIX = "google-token:"


def google_token(email: str) -> str:
    """A fake ID token the FakeGoogleVerifier accepts for `email`."""
    return f"{TOKEN_PREFIX}{email}"


class FakeGoogleVerifier:
    """Accepts tokens built by google_token(); everything else is rejected like a forged token."""

    def verify(self, token: str) -> GoogleIdentity:
        if not token.startswith(TOKEN_PREFIX):
            raise AppError("INVALID_GOOGLE_TOKEN", "Google sign-in could not be verified.", 401)
        email = token.removeprefix(TOKEN_PREFIX)
        return GoogleIdentity(
            sub=f"google-sub-{email}",
            email=email,
            name=email.split("@")[0].title(),
            picture=None,
        )
