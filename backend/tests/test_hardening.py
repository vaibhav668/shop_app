"""Rate limits, security headers and the request size ceiling."""

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.rate_limit import GlobalRateLimitMiddleware, SlidingWindowLimiter, limit, limiter
from app.core.security_headers import MAX_BODY_BYTES, SecurityHeadersMiddleware


def make_app(**settings_overrides: object) -> TestClient:
    settings = Settings(**({"app_env": "test", "rate_limits_enabled": True} | settings_overrides))
    app = FastAPI()
    app.dependency_overrides[get_settings] = lambda: settings
    app.add_middleware(GlobalRateLimitMiddleware, settings=settings, times=5, per_seconds=60)
    app.add_middleware(SecurityHeadersMiddleware, settings=settings)
    register_error_handlers(app)

    @app.post("/api/v1/auth/google", dependencies=[Depends(limit("t-google", 2, 60))])
    def google() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/v1/open")
    def open_route() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/api/v1/upload")
    def upload() -> dict[str, bool]:
        return {"ok": True}

    limiter.reset()
    return TestClient(app)


def test_sliding_window_counts_and_recovers() -> None:
    window = SlidingWindowLimiter()
    assert window.hit("k", 2, 60) is None
    assert window.hit("k", 2, 60) is None
    wait = window.hit("k", 2, 60)
    assert wait is not None and 0 < wait <= 60
    # A different client has its own budget.
    assert window.hit("other", 2, 60) is None
    # A window that has passed frees the budget again.
    assert window.hit("short", 1, 0.0) is None
    assert window.hit("short", 1, 0.0) is None


def test_route_limit_returns_429_with_retry_after() -> None:
    client = make_app()
    assert client.post("/api/v1/auth/google").status_code == 200
    assert client.post("/api/v1/auth/google").status_code == 200
    blocked = client.post("/api/v1/auth/google")
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    assert int(blocked.headers["Retry-After"]) >= 1


def test_global_ceiling_applies_to_every_api_route() -> None:
    client = make_app()
    for _ in range(5):
        assert client.get("/api/v1/open").status_code == 200
    blocked = client.get("/api/v1/open")
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


def test_limits_can_be_switched_off() -> None:
    client = make_app(rate_limits_enabled=False)
    for _ in range(10):
        assert client.post("/api/v1/auth/google").status_code == 200


def test_security_headers_and_no_store(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    # Not deployed: no HSTS (it would pin localhost to HTTPS).
    assert "Strict-Transport-Security" not in response.headers

    me = client.get("/api/v1/me")
    assert me.headers["Cache-Control"] == "no-store"


def test_hsts_when_deployed() -> None:
    client = make_app()
    deployed = FastAPI()
    deployed.add_middleware(
        SecurityHeadersMiddleware,
        settings=Settings.model_construct(app_env="production"),
    )

    @deployed.get("/x")
    def x() -> dict[str, bool]:
        return {"ok": True}

    assert "max-age" in TestClient(deployed).get("/x").headers["Strict-Transport-Security"]
    assert client.get("/api/v1/open").status_code == 200


def test_oversized_bodies_are_refused_early() -> None:
    client = make_app()
    response = client.post(
        "/api/v1/upload",
        content=b"x" * 10,
        headers={"Content-Length": str(MAX_BODY_BYTES + 1)},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
