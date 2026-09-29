import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

_INSECURE_DEV_SECRET = "dev-only-insecure-jwt-secret-change-me"


class Settings(BaseSettings):
    """Runtime configuration. Values come from environment variables or backend/.env."""

    model_config = SettingsConfigDict(
        # The test suite must not depend on a developer's local .env.
        env_file=None if os.environ.get("APP_ENV") == "test" else BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["local", "test", "staging", "production"] = "local"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://shop:shop@localhost:5432/shop"
    test_database_url: str = "postgresql+psycopg://shop:shop@localhost:5432/shop_test"

    cors_origins: str = "http://localhost:5173"
    shop_timezone: str = "Asia/Kolkata"

    jwt_secret: str = _INSECURE_DEV_SECRET
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 60
    google_allowed_client_ids: str = ""
    admin_cookie_secure: bool = False
    # Local-only shortcut that signs in by email without Google. Never allowed outside local/test.
    dev_login_enabled: bool = False

    storage_provider: Literal["local", "cloudinary"] = "local"
    media_dir: Path = BACKEND_DIR / "media"
    cloudinary_url: str = ""

    # "fake" logs pushes instead of sending them (local/test). "fcm" sends through Firebase
    # Cloud Messaging with a service-account key file (never committed; see docs).
    push_provider: Literal["fake", "fcm"] = "fake"
    firebase_credentials_file: Path | None = None

    @model_validator(mode="after")
    def _guard_deployed_environments(self) -> "Settings":
        if self.app_env in ("staging", "production"):
            if self.jwt_secret == _INSECURE_DEV_SECRET or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be set to a random value of 32+ characters.")
            if self.dev_login_enabled:
                raise ValueError("DEV_LOGIN_ENABLED is only allowed in local/test.")
            if self.storage_provider == "local":
                raise ValueError("Use cloud image storage (STORAGE_PROVIDER) outside local/test.")
            if self.push_provider == "fake":
                raise ValueError("Use PUSH_PROVIDER=fcm outside local/test.")
        if self.storage_provider == "cloudinary" and not self.cloudinary_url:
            raise ValueError("STORAGE_PROVIDER=cloudinary needs CLOUDINARY_URL.")
        if self.push_provider == "fcm" and not self.firebase_credentials_file:
            raise ValueError("PUSH_PROVIDER=fcm needs FIREBASE_CREDENTIALS_FILE.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return _split_csv(self.cors_origins)

    @property
    def google_client_id_list(self) -> list[str]:
        return _split_csv(self.google_allowed_client_ids)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
