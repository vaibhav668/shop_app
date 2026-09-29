from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.shop import get_delivery_area
from app.models import User
from app.routers.cart import get_views, line_out
from app.schemas.checkout import CheckoutQuoteOut, CheckoutQuoteRequest
from app.services.addresses import AddressService
from app.services.catalog_views import CatalogViews
from app.services.checkout import CheckoutService
from app.services.delivery import DeliveryArea

router = APIRouter(prefix="/checkout", tags=["checkout"])


@router.post("/quote", response_model=CheckoutQuoteOut)
def checkout_quote(
    payload: CheckoutQuoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    area: DeliveryArea = Depends(get_delivery_area),
    views: CatalogViews = Depends(get_views),
) -> CheckoutQuoteOut:
    """Prices come from the server only. Blocking problems are listed in `issues` rather than
    raised, so the checkout screen can show all of them at once."""
    addresses = AddressService(db, area)
    result = CheckoutService(db, addresses).quote(user, payload)
    q = result.quote
    return CheckoutQuoteOut(
        lines=[line_out(line, views) for line in q.lines],
        item_count=q.item_count,
        subtotal_paise=q.subtotal_paise,
        delivery_fee_paise=q.delivery_fee_paise,
        total_paise=q.total_paise,
        address=addresses.out(result.address),
        payment_methods=result.payment_methods,
        issues=result.issues,
        can_place_order=not result.issues,
    )
