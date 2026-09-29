from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.dependencies.db import get_db
from app.services.delivery import DeliveryArea
from app.services.shop import get_shop_settings


def get_delivery_area(
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> DeliveryArea:
    return DeliveryArea.from_settings(get_shop_settings(db), settings.app_env)
