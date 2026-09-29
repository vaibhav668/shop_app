"""The checkout quote: the exact amount an order would cost right now, and anything blocking it.
It reads only. Order placement (Phase 7) re-runs the same checks inside its transaction."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Address, Product, ShopSettings, User
from app.schemas.checkout import CheckoutIssue, CheckoutQuoteRequest, PaymentMethod
from app.services.addresses import AddressService
from app.services.pricing import Quote, quote
from app.services.shop import get_shop_settings
from app.utils.money import format_rupees

# Online payment arrives in Phase 8; until then the switch in settings has no effect.
SUPPORTED_PAYMENT_METHODS: tuple[PaymentMethod, ...] = ("COD",)


@dataclass(frozen=True)
class CheckoutQuote:
    quote: Quote
    address: Address
    payment_methods: list[PaymentMethod]
    issues: list[CheckoutIssue]


def enabled_payment_methods(settings: ShopSettings) -> list[PaymentMethod]:
    enabled = {"COD": settings.cod_enabled, "ONLINE": settings.online_payment_enabled}
    return [m for m in SUPPORTED_PAYMENT_METHODS if enabled[m]]


class CheckoutService:
    def __init__(self, db: Session, addresses: AddressService) -> None:
        self.db = db
        self.addresses = addresses

    def quote(self, user: User, request: CheckoutQuoteRequest) -> CheckoutQuote:
        address = self.addresses.get(user, request.address_id)  # another user's → 404
        settings = get_shop_settings(self.db)

        ids = [item.product_id for item in request.items]
        products = {
            p.id: p
            for p in self.db.scalars(
                select(Product).options(joinedload(Product.category)).where(Product.id.in_(ids))
            )
        }
        # Products that no longer exist at all are dropped; the app refreshes its cart anyway.
        result = quote(
            [
                (products[i.product_id], i.quantity)
                for i in request.items
                if i.product_id in products
            ],
            settings,
        )
        methods = enabled_payment_methods(settings)
        return CheckoutQuote(
            quote=result,
            address=address,
            payment_methods=methods,
            issues=self._issues(result, address, settings, methods),
        )

    def _issues(
        self,
        result: Quote,
        address: Address,
        settings: ShopSettings,
        methods: list[PaymentMethod],
    ) -> list[CheckoutIssue]:
        issues: list[CheckoutIssue] = []
        if not settings.is_accepting_orders:
            issues.append(CheckoutIssue(code="SHOP_CLOSED", message=settings.closed_message))
        if not self.addresses.area.covers(address.pincode):
            issues.append(
                CheckoutIssue(
                    code="NOT_SERVICEABLE",
                    message=f"Sorry, we don't deliver to {address.pincode} yet.",
                )
            )
        if result.has_issues:
            issues.append(
                CheckoutIssue(
                    code="ITEMS_CHANGED",
                    message="Some items changed. Review your cart before ordering.",
                )
            )
        if result.item_count == 0:
            issues.append(CheckoutIssue(code="EMPTY_ORDER", message="Your order has no items."))
        elif result.min_order_remaining_paise > 0:
            issues.append(
                CheckoutIssue(
                    code="BELOW_MIN_ORDER",
                    message=(
                        f"Minimum order is {format_rupees(settings.min_order_paise)}. "
                        f"Add {format_rupees(result.min_order_remaining_paise)} more."
                    ),
                )
            )
        if not methods:
            issues.append(
                CheckoutIssue(
                    code="NO_PAYMENT_METHOD",
                    message="Ordering is paused right now. Please try again later.",
                )
            )
        return issues
