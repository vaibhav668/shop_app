# Import every model module here so Alembic autogenerate sees the full metadata.
from app.models.banner import Banner, BannerTarget
from app.models.base import Base
from app.models.cart import MAX_LINE_QUANTITY, Cart, CartItem, Favourite
from app.models.catalog import Category, InventoryMovement, InventoryReason, Product, ShopSettings
from app.models.user import DeviceToken, SessionClient, User, UserRole, UserSession

__all__ = [
    "MAX_LINE_QUANTITY",
    "Banner",
    "BannerTarget",
    "Base",
    "Cart",
    "CartItem",
    "Category",
    "DeviceToken",
    "Favourite",
    "InventoryMovement",
    "InventoryReason",
    "Product",
    "SessionClient",
    "ShopSettings",
    "User",
    "UserRole",
    "UserSession",
]
