"""The ONLY place money is calculated. Cart, checkout quote and order placement all use this,
so the customer is always shown exactly what they will be charged. Client prices are never used."""

from dataclasses import dataclass
from typing import Literal

from app.models import MAX_LINE_QUANTITY, Product, ShopSettings
from app.services.catalog_views import is_available

LineIssue = Literal["UNAVAILABLE", "OUT_OF_STOCK", "QUANTITY_REDUCED"]


@dataclass(frozen=True)
class PricedLine:
    product: Product
    quantity: int  # what the customer asked for
    effective_quantity: int  # what can actually be sold right now
    unit_price_paise: int
    line_total_paise: int
    issue: LineIssue | None


@dataclass(frozen=True)
class Quote:
    lines: list[PricedLine]
    item_count: int
    subtotal_paise: int
    delivery_fee_paise: int
    total_paise: int
    free_delivery_remaining_paise: int
    min_order_remaining_paise: int

    @property
    def has_issues(self) -> bool:
        return any(line.issue for line in self.lines)


def max_orderable(product: Product) -> int:
    """How many one order may contain right now: stock, the product's cap and the hard cap."""
    limit = min(product.max_per_order or MAX_LINE_QUANTITY, MAX_LINE_QUANTITY)
    return max(0, min(product.stock_quantity, limit))


def price_line(product: Product, quantity: int) -> PricedLine:
    if not (product.is_active and product.archived_at is None and product.category.is_active):
        effective, issue = 0, "UNAVAILABLE"
    elif not is_available(product):
        effective, issue = 0, "OUT_OF_STOCK"
    else:
        effective = min(quantity, max_orderable(product))
        issue = "QUANTITY_REDUCED" if effective < quantity else None
    return PricedLine(
        product=product,
        quantity=quantity,
        effective_quantity=effective,
        unit_price_paise=product.price_paise,
        line_total_paise=product.price_paise * effective,
        issue=issue,
    )


def delivery_fee_for(subtotal_paise: int, settings: ShopSettings) -> int:
    if subtotal_paise == 0 or subtotal_paise >= settings.free_delivery_above_paise:
        return 0
    return settings.delivery_fee_paise


def quote(items: list[tuple[Product, int]], settings: ShopSettings) -> Quote:
    lines = [price_line(product, qty) for product, qty in items]
    subtotal = sum(line.line_total_paise for line in lines)
    fee = delivery_fee_for(subtotal, settings)
    return Quote(
        lines=lines,
        item_count=sum(line.effective_quantity for line in lines),
        subtotal_paise=subtotal,
        delivery_fee_paise=fee,
        total_paise=subtotal + fee,
        free_delivery_remaining_paise=(
            max(0, settings.free_delivery_above_paise - subtotal) if subtotal else 0
        ),
        min_order_remaining_paise=max(0, settings.min_order_paise - subtotal),
    )
