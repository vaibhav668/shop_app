# Import every model module here so Alembic autogenerate sees the full metadata.
from app.models.banner import Banner, BannerTarget
from app.models.base import Base
from app.models.catalog import Category, InventoryMovement, InventoryReason, Product, ShopSettings
from app.models.user import DeviceToken, SessionClient, User, UserRole, UserSession

__all__ = [
    "Banner",
    "BannerTarget",
    "Base",
    "Category",
    "DeviceToken",
    "InventoryMovement",
    "InventoryReason",
    "Product",
    "SessionClient",
    "ShopSettings",
    "User",
    "UserRole",
    "UserSession",
]
