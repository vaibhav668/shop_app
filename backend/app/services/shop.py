from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import utcnow
from app.models import ShopSettings
from app.schemas.admin_settings import AdminSettingsUpdate


def get_shop_settings(db: Session) -> ShopSettings:
    settings = db.get(ShopSettings, 1)
    if settings is None:  # created by migration 0003; recreated defensively
        settings = ShopSettings(id=1)
        db.add(settings)
        db.flush()
    return settings


def update_shop_settings(db: Session, data: AdminSettingsUpdate) -> ShopSettings:
    settings = db.get(ShopSettings, 1, with_for_update=True) or get_shop_settings(db)
    for field in data.model_fields_set:
        value = getattr(data, field)
        if value is None and field not in ("shop_phone", "shop_address"):
            continue  # null means "unchanged" for fields that can't be empty
        setattr(settings, field, value)

    if not (settings.cod_enabled or settings.online_payment_enabled):
        db.rollback()
        raise AppError(
            "VALIDATION_ERROR",
            "Keep at least one payment method on. To pause orders, switch off Accepting orders.",
            400,
            {"fields": [{"loc": "body.cod_enabled", "message": "no payment method enabled"}]},
        )
    settings.updated_at = utcnow()
    db.commit()
    return settings
