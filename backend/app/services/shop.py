from sqlalchemy.orm import Session

from app.models import ShopSettings


def get_shop_settings(db: Session) -> ShopSettings:
    settings = db.get(ShopSettings, 1)
    if settings is None:  # created by migration 0003; recreated defensively
        settings = ShopSettings(id=1)
        db.add(settings)
        db.flush()
    return settings
