import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError
from app.core.security import utcnow
from app.integrations.storage import StorageProvider
from app.models import Category, Product, ShopSettings
from app.schemas.admin_catalog import (
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductStatus,
    ProductUpdate,
)
from app.services.inventory import InventoryService
from app.utils.slugs import unique_slug


def _not_found(what: str) -> AppError:
    return AppError("NOT_FOUND", f"{what} not found.", 404)


class AdminCatalogService:
    def __init__(self, db: Session, storage: StorageProvider) -> None:
        self.db = db
        self.storage = storage
        self._stale_images: list[str] = []

    # --- categories ------------------------------------------------------------------------

    def list_categories(self) -> list[tuple[Category, int]]:
        counts = (
            select(Product.category_id, func.count().label("n"))
            .where(Product.archived_at.is_(None))
            .group_by(Product.category_id)
            .subquery()
        )
        rows = self.db.execute(
            select(Category, func.coalesce(counts.c.n, 0))
            .outerjoin(counts, counts.c.category_id == Category.id)
            .order_by(Category.sort_order, Category.name)
        ).all()
        return [(category, count) for category, count in rows]

    def product_count(self, category_id: uuid.UUID) -> int:
        return (
            self.db.scalar(
                select(func.count()).where(
                    Product.category_id == category_id, Product.archived_at.is_(None)
                )
            )
            or 0
        )

    def create_category(self, data: CategoryCreate) -> Category:
        next_order = (self.db.scalar(select(func.max(Category.sort_order))) or 0) + 1
        category = Category(
            name=data.name,
            slug=unique_slug(data.name, self._category_slug_taken),
            image_key=data.image_key,
            is_active=data.is_active,
            sort_order=next_order,
        )
        self.db.add(category)
        self.db.commit()
        return category

    def update_category(self, category_id: uuid.UUID, data: CategoryUpdate) -> Category:
        category = self._category(category_id)
        if data.name is not None and data.name != category.name:
            category.name = data.name
            category.slug = unique_slug(data.name, self._category_slug_taken)
        if data.is_active is not None:
            category.is_active = data.is_active
        self._replace_image(category, data.image_key, data.remove_image)
        self.db.commit()
        self._delete_stale_images()
        return category

    def delete_category(self, category_id: uuid.UUID) -> None:
        category = self._category(category_id)
        if self.db.scalar(select(func.count()).where(Product.category_id == category_id)):
            raise AppError(
                "CATEGORY_NOT_EMPTY",
                "Move or delete this category's products first, or hide the category instead.",
                409,
            )
        if category.image_key:
            self._stale_images.append(category.image_key)
        self.db.delete(category)
        self.db.commit()
        self._delete_stale_images()

    def reorder_categories(self, ids: list[uuid.UUID]) -> None:
        categories = {c.id: c for c in self.db.scalars(select(Category))}
        if set(ids) != set(categories) or len(ids) != len(categories):
            raise AppError("VALIDATION_ERROR", "Send every category exactly once.", 400)
        for position, category_id in enumerate(ids, start=1):
            categories[category_id].sort_order = position
        self.db.commit()

    # --- products --------------------------------------------------------------------------

    def list_products(
        self,
        *,
        q: str | None,
        category_id: uuid.UUID | None,
        status: ProductStatus,
        low_stock: bool,
        settings: ShopSettings,
        limit: int,
        offset: int,
    ) -> tuple[list[Product], int]:
        stmt = select(Product).options(joinedload(Product.category))
        if status == "active":
            stmt = stmt.where(Product.archived_at.is_(None), Product.is_active)
        elif status == "inactive":
            stmt = stmt.where(Product.archived_at.is_(None), Product.is_active.is_(False))
        elif status == "archived":
            stmt = stmt.where(Product.archived_at.is_not(None))
        else:
            stmt = stmt.where(Product.archived_at.is_(None))
        if category_id is not None:
            stmt = stmt.where(Product.category_id == category_id)
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(Product.name.ilike(pattern), Product.search_keywords.ilike(pattern))
            )
        if low_stock:
            threshold = func.coalesce(
                Product.low_stock_threshold, settings.default_low_stock_threshold
            )
            stmt = stmt.where(Product.stock_quantity <= threshold)

        total = (
            self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        )
        items = self.db.scalars(
            stmt.order_by(Product.name, Product.id).limit(limit).offset(offset)
        ).unique()
        return list(items), total

    def get_product(self, product_id: uuid.UUID) -> Product:
        product = self.db.scalar(
            select(Product).options(joinedload(Product.category)).where(Product.id == product_id)
        )
        if product is None:
            raise _not_found("Product")
        return product

    def create_product(self, data: ProductCreate, actor_id: uuid.UUID) -> Product:
        self._category(data.category_id)
        product = Product(
            category_id=data.category_id,
            name=data.name,
            slug=unique_slug(data.name, self._product_slug_taken),
            unit_label=data.unit_label,
            price_paise=data.price_paise,
            mrp_paise=data.mrp_paise,
            stock_quantity=data.stock_quantity,
            description=data.description or None,
            image_key=data.image_key,
            search_keywords=data.search_keywords or None,
            low_stock_threshold=data.low_stock_threshold,
            max_per_order=data.max_per_order,
            is_active=data.is_active,
            is_featured=data.is_featured,
        )
        self.db.add(product)
        self.db.flush()
        InventoryService(self.db).record_initial(product, actor_id)
        self.db.commit()
        return self.get_product(product.id)

    def update_product(self, product_id: uuid.UUID, data: ProductUpdate) -> Product:
        product = self.get_product(product_id)
        sent = data.model_fields_set

        if "category_id" in sent and data.category_id is not None:
            self._category(data.category_id)
            product.category_id = data.category_id
        if "name" in sent and data.name is not None and data.name != product.name:
            product.name = data.name
            product.slug = unique_slug(data.name, self._product_slug_taken)
        for field in ("unit_label", "price_paise", "mrp_paise", "is_active", "is_featured"):
            if field in sent and getattr(data, field) is not None:
                setattr(product, field, getattr(data, field))
        # Nullable fields: an explicit null clears them.
        for field in ("description", "search_keywords", "low_stock_threshold", "max_per_order"):
            if field in sent:
                value = getattr(data, field)
                setattr(product, field, value if value != "" else None)

        if product.mrp_paise < product.price_paise:
            raise AppError("VALIDATION_ERROR", "MRP can't be lower than the selling price.", 400)

        self._replace_image(product, data.image_key, data.remove_image)
        self.db.commit()
        self._delete_stale_images()
        return self.get_product(product.id)

    def archive_product(self, product_id: uuid.UUID) -> Product:
        product = self.get_product(product_id)
        if product.archived_at is None:
            product.archived_at = utcnow()
            self.db.commit()
        return self.get_product(product.id)

    def restore_product(self, product_id: uuid.UUID) -> Product:
        product = self.get_product(product_id)
        product.archived_at = None
        self.db.commit()
        return self.get_product(product.id)

    # --- helpers ---------------------------------------------------------------------------

    def _category(self, category_id: uuid.UUID) -> Category:
        category = self.db.get(Category, category_id)
        if category is None:
            raise _not_found("Category")
        return category

    def _category_slug_taken(self, slug: str) -> bool:
        return self.db.scalar(select(Category.id).where(Category.slug == slug)) is not None

    def _product_slug_taken(self, slug: str) -> bool:
        return self.db.scalar(select(Product.id).where(Product.slug == slug)) is not None

    def _replace_image(self, row: Category | Product, new_key: str | None, remove: bool) -> None:
        if (new_key or remove) and row.image_key and row.image_key != new_key:
            self._stale_images.append(row.image_key)
        if new_key:
            row.image_key = new_key
        elif remove:
            row.image_key = None

    def _delete_stale_images(self) -> None:
        # Only after commit: never delete a file that a rolled-back row still points at.
        for key in self._stale_images:
            self.storage.delete(key)
        self._stale_images.clear()
