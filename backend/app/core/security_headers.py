"""Security headers on every response, and a ceiling on request body size."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import Settings
from app.core.errors import error_response

# A little over the 5 MB photo limit, to allow for the multipart wrapping.
MAX_BODY_BYTES = 6 * 1024 * 1024

# Responses that must never be cached (tokens, personal data).
_NO_STORE_PREFIXES = ("/api/v1/auth", "/api/v1/me", "/api/v1/orders", "/api/v1/admin")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.deployed = settings.app_env in ("staging", "production")

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return error_response(413, "PAYLOAD_TOO_LARGE", "That upload is too large.")

        response = await call_next(request)
        path = request.url.path
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        # The API only returns data: nothing it serves should run scripts or be framed.
        # (The interactive /docs page exists only outside production and needs its scripts.)
        if path != "/docs":
            h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if path.startswith(_NO_STORE_PREFIXES):
            h.setdefault("Cache-Control", "no-store")
        if self.deployed:
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
