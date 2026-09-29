from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.shop import get_delivery_area
from app.models import ShopSettings
from app.schemas.admin_settings import AdminSettingsOut, AdminSettingsUpdate
from app.services.delivery import DeliveryArea
from app.services.shop import get_shop_settings, update_shop_settings

router = APIRouter(prefix="/settings")


def _out(s: ShopSettings, area: DeliveryArea) -> AdminSettingsOut:
    return AdminSettingsOut(
        shop_name=s.shop_name,
        shop_phone=s.shop_phone,
        shop_address=s.shop_address,
        is_accepting_orders=s.is_accepting_orders,
        closed_message=s.closed_message,
        delivery_fee_paise=s.delivery_fee_paise,
        free_delivery_above_paise=s.free_delivery_above_paise,
        min_order_paise=s.min_order_paise,
        serviceable_pincodes=list(s.serviceable_pincodes or []),
        empty_pincodes_accept_all=area.open_when_unset,
        cod_enabled=s.cod_enabled,
        online_payment_enabled=s.online_payment_enabled,
        payment_timeout_minutes=s.payment_timeout_minutes,
        default_low_stock_threshold=s.default_low_stock_threshold,
        updated_at=s.updated_at,
    )


@router.get("", response_model=AdminSettingsOut)
def read_settings(
    db: Session = Depends(get_db), area: DeliveryArea = Depends(get_delivery_area)
) -> AdminSettingsOut:
    return _out(get_shop_settings(db), area)


@router.patch("", response_model=AdminSettingsOut)
def update_settings(
    payload: AdminSettingsUpdate,
    db: Session = Depends(get_db),
    area: DeliveryArea = Depends(get_delivery_area),
) -> AdminSettingsOut:
    return _out(update_shop_settings(db, payload), area)
