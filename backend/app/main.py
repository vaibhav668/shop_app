from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.routers import addresses, admin, auth, cart, catalog, checkout, health, me, orders

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Bada Bazar API",
        version="0.1.0",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )
    # Request-time dependencies must see the same settings the app was built with.
    app.dependency_overrides[get_settings] = lambda: settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    if settings.dev_login_enabled and settings.app_env in ("local", "test"):
        app.include_router(auth.dev_router, prefix=API_PREFIX)
    app.include_router(me.router, prefix=API_PREFIX)
    app.include_router(catalog.router, prefix=API_PREFIX)
    app.include_router(cart.router, prefix=API_PREFIX)
    app.include_router(addresses.router, prefix=API_PREFIX)
    app.include_router(checkout.router, prefix=API_PREFIX)
    app.include_router(orders.router, prefix=API_PREFIX)
    app.include_router(admin.router, prefix=API_PREFIX)

    if settings.storage_provider == "local":
        # Development only (settings refuse local storage in staging/production).
        settings.media_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app


app = create_app()
