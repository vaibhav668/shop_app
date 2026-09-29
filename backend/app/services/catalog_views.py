"""Turns catalog rows into API DTOs: image URLs from the storage provider, stock hints from the
shop's low-stock threshold. The one place these rules live."""

from app.integrations.storage import StorageProvider
from app.models import Category, Product
from app.schemas.admin_catalog import AdminCategoryOut, AdminProductOut
from app.schemas.catalog import (
    CategoryOut,
    CategoryRef,
    ProductCardOut,
    ProductDetailOut,
    StockHint,
)

CARD_IMAGE_WIDTH = 400
DETAIL_IMAGE_WIDTH = 900
CATEGORY_IMAGE_WIDTH = 240


def discount_percent(price_paise: int, mrp_paise: int) -> int:
    if mrp_paise <= 0 or price_paise >= mrp_paise:
        return 0
    return (mrp_paise - price_paise) * 100 // mrp_paise


def low_stock_threshold(product: Product, default_threshold: int) -> int:
    if product.low_stock_threshold is not None:
        return product.low_stock_threshold
    return default_threshold


def is_available(product: Product) -> bool:
    return (
        product.is_active
        and product.archived_at is None
        and product.category.is_active
        and product.stock_quantity > 0
    )


def stock_hint(product: Product, default_threshold: int) -> StockHint:
    if not is_available(product):
        return "OUT"
    if product.stock_quantity <= low_stock_threshold(product, default_threshold):
        return "LOW"
    return "IN_STOCK"


class CatalogViews:
    def __init__(self, storage: StorageProvider, default_low_stock_threshold: int) -> None:
        self.storage = storage
        self.threshold = default_low_stock_threshold

    def _image(self, key: str | None, width: int) -> str | None:
        return self.storage.url(key, width=width) if key else None

    def category(self, category: Category) -> CategoryOut:
        return CategoryOut(
            id=category.id,
            name=category.name,
            slug=category.slug,
            image_url=self._image(category.image_key, CATEGORY_IMAGE_WIDTH),
        )

    def card(self, product: Product, *, image_width: int = CARD_IMAGE_WIDTH) -> ProductCardOut:
        return ProductCardOut(
            id=product.id,
            name=product.name,
            unit_label=product.unit_label,
            price_paise=product.price_paise,
            mrp_paise=product.mrp_paise,
            discount_percent=discount_percent(product.price_paise, product.mrp_paise),
            image_url=self._image(product.image_key, image_width),
            is_available=is_available(product),
            stock_hint=stock_hint(product, self.threshold),
            max_per_order=product.max_per_order,
        )

    def detail(self, product: Product, related: list[Product]) -> ProductDetailOut:
        card = self.card(product, image_width=DETAIL_IMAGE_WIDTH)
        return ProductDetailOut(
            **card.model_dump(),
            description=product.description,
            category=CategoryRef(
                id=product.category.id, name=product.category.name, slug=product.category.slug
            ),
            related=[self.card(p) for p in related],
        )

    def admin_category(self, category: Category, product_count: int) -> AdminCategoryOut:
        return AdminCategoryOut(
            id=category.id,
            name=category.name,
            slug=category.slug,
            image_key=category.image_key,
            image_url=self._image(category.image_key, CATEGORY_IMAGE_WIDTH),
            sort_order=category.sort_order,
            is_active=category.is_active,
            product_count=product_count,
        )

    def admin_product(self, product: Product) -> AdminProductOut:
        return AdminProductOut(
            id=product.id,
            category_id=product.category_id,
            category_name=product.category.name,
            name=product.name,
            slug=product.slug,
            description=product.description,
            unit_label=product.unit_label,
            price_paise=product.price_paise,
            mrp_paise=product.mrp_paise,
            stock_quantity=product.stock_quantity,
            low_stock_threshold=product.low_stock_threshold,
            max_per_order=product.max_per_order,
            is_active=product.is_active,
            is_featured=product.is_featured,
            is_low_stock=product.stock_quantity <= low_stock_threshold(product, self.threshold),
            image_key=product.image_key,
            image_url=self._image(product.image_key, CARD_IMAGE_WIDTH),
            search_keywords=product.search_keywords,
            archived_at=product.archived_at,
            updated_at=product.updated_at,
        )
