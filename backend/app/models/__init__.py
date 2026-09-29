# Import every model module here so Alembic autogenerate sees the full metadata.
from app.models.base import Base
from app.models.user import DeviceToken, SessionClient, User, UserRole, UserSession

__all__ = ["Base", "DeviceToken", "SessionClient", "User", "UserRole", "UserSession"]
