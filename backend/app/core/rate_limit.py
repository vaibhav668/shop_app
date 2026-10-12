"""In-process rate limits.

A sliding window per (rule, client IP): `limit(...)` makes a FastAPI dependency for one route,
and `GlobalRateLimitMiddleware` caps everything under /api per client. Counts live in the
worker's memory, so with N workers a client can reach N times a limit; that is fine for one
shop, and the limits are set with that in mind. Behind a proxy, run uvicorn/gunicorn with
--proxy-headers (and --forwarded-allow-ips) so the client IP is the real one.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import Settings, get_settings
from app.core.errors import AppError, error_response


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, times: int, per_seconds: float) -> float | None:
        """Records a request; returns seconds to wait if over the limit, else None."""
        now = time.monotonic()
        with self._lock:
            window = self._hits.setdefault(key, deque())
            while window and window[0] <= now - per_seconds:
                window.popleft()
            if len(window) >= times:
                return window[0] + per_seconds - now
            window.append(now)
            # Keep memory bounded: drop idle keys now and then.
            if len(self._hits) > 50_000:
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > now - 3600}
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(retry_after: float) -> AppError:
    seconds = max(1, math.ceil(retry_after))
    return AppError(
        "RATE_LIMITED",
        "Too many requests. Please wait a moment and try again.",
        429,
        {"retry_after_seconds": seconds},
        headers={"Retry-After": str(seconds)},
    )


def limit(name: str, times: int, per_seconds: float) -> Callable[..., None]:
    """A route dependency allowing `times` requests per `per_seconds` from one client."""

    def dependency(request: Request) -> None:
        settings: Settings = request.app.dependency_overrides.get(get_settings, get_settings)()
        if not settings.rate_limits_active:
            return
        wait = limiter.hit(f"{name}:{client_ip(request)}", times, per_seconds)
        if wait is not None:
            raise _too_many(wait)

    return dependency


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """A generous ceiling on all API traffic from one client (stops scripted floods)."""

    def __init__(self, app, settings: Settings, times: int = 600, per_seconds: float = 60) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.settings = settings
        self.times = times
        self.per_seconds = per_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if self.settings.rate_limits_active and request.url.path.startswith("/api/"):
            wait = limiter.hit(f"global:{client_ip(request)}", self.times, self.per_seconds)
            if wait is not None:
                err = _too_many(wait)
                response = error_response(err.status_code, err.code, err.message, err.details)
                response.headers.update(err.headers)
                return response
        return await call_next(request)
