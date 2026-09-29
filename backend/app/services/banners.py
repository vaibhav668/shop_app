"""Home-screen banners: admin management and resolving what each banner links to."""

import uuid
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import utcnow
from app.integrations.storage import StorageProvider
from app.models import Banner, BannerTarget, Category, Product
from app.repositories.catalog import customer_visible_products
from app.schemas.admin_catalog import AdminBannerOut, BannerCreate, BannerUpdate
from app.schemas.catalog import BannerOut

BANNER_IMAGE_WIDTH = 900


def is_live(banner: Banner, now: datetime) -> bool:
    return (
        banner.is_active
        and (banner.starts_at is None or banner.starts_at <= now)
        and (banner.ends_at is None or banner.ends_at > now)
    )


class BannerService:
    def __init__(self, db: Session, storage: StorageProvider) -> None:
        self.db = db
        self.storage = storage

    # --- customer ---------------------------------------------------------------------------

    def live_banners(self) -> list[BannerOut]:
        now = utcnow()
        banners = self.db.scalars(
            select(Banner)
            .where(
                Banner.is_active,
                or_(Banner.starts_at.is_(None), Banner.starts_at <= now),
                or_(Banner.ends_at.is_(None), Banner.ends_at > now),
            )
            .order_by(Banner.sort_order, Banner.created_at)
        )
        return [self._customer_view(b) for b in banners]

    def _customer_view(self, banner: Banner) -> BannerOut:
        target_type, target_id, slug = "NONE", None, None
        if banner.target_type is BannerTarget.CATEGORY and banner.target_id:
            category = self.db.scalar(
                select(Category).where(Category.id == banner.target_id, Category.is_active)
            )
            if category:
                target_type, target_id, slug = "CATEGORY", category.id, category.slug
        elif banner.target_type is BannerTarget.PRODUCT and banner.target_id:
            product = self.db.scalar(
                customer_visible_products().where(Product.id == banner.target_id)
            )
            if product:
                target_type, target_id = "PRODUCT", product.id
        # A hidden or deleted target leaves the banner up, just without a link.
        return BannerOut(
            id=banner.id,
            title=banner.title,
            subtitle=banner.subtitle,
            image_url=self._image(banner.image_key),
            target_type=target_type,
            target_id=target_id,
            target_slug=slug,
        )

    # --- admin ------------------------------------------------------------------------------

    def list_all(self) -> list[AdminBannerOut]:
        banners = self.db.scalars(select(Banner).order_by(Banner.sort_order, Banner.created_at))
        return [self.admin_view(b) for b in banners]

    def create(self, data: BannerCreate) -> AdminBannerOut:
        self._check_target(data.target_type, data.target_id)
        next_order = (self.db.scalar(select(func.max(Banner.sort_order))) or 0) + 1
        banner = Banner(
            title=data.title,
            subtitle=data.subtitle or None,
            image_key=data.image_key,
            target_type=BannerTarget(data.target_type),
            target_id=data.target_id,
            is_active=data.is_active,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            sort_order=next_order,
        )
        self.db.add(banner)
        self.db.commit()
        return self.admin_view(banner)

    def update(self, banner_id: uuid.UUID, data: BannerUpdate) -> AdminBannerOut:
        banner = self._get(banner_id)
        sent = data.model_fields_set
        stale: str | None = None

        if "title" in sent and data.title is not None:
            banner.title = data.title
        if "subtitle" in sent:
            banner.subtitle = data.subtitle or None
        if "target_type" in sent and data.target_type is not None:
            self._check_target(data.target_type, data.target_id)
            banner.target_type = BannerTarget(data.target_type)
            banner.target_id = data.target_id
        if "is_active" in sent and data.is_active is not None:
            banner.is_active = data.is_active
        for field in ("starts_at", "ends_at"):
            if field in sent:
                setattr(banner, field, getattr(data, field))
        if banner.starts_at and banner.ends_at and banner.ends_at <= banner.starts_at:
            raise AppError("VALIDATION_ERROR", "The end date must be after the start date.", 400)
        if data.image_key or data.remove_image:
            stale = banner.image_key if banner.image_key != data.image_key else None
            banner.image_key = data.image_key or None

        self.db.commit()
        if stale:
            self.storage.delete(stale)
        return self.admin_view(banner)

    def delete(self, banner_id: uuid.UUID) -> None:
        banner = self._get(banner_id)
        key = banner.image_key
        self.db.delete(banner)
        self.db.commit()
        if key:
            self.storage.delete(key)

    def reorder(self, ids: list[uuid.UUID]) -> None:
        banners = {b.id: b for b in self.db.scalars(select(Banner))}
        if set(ids) != set(banners) or len(ids) != len(banners):
            raise AppError("VALIDATION_ERROR", "Send every banner exactly once.", 400)
        for position, banner_id in enumerate(ids, start=1):
            banners[banner_id].sort_order = position
        self.db.commit()

    def admin_view(self, banner: Banner) -> AdminBannerOut:
        label = None
        if banner.target_type is BannerTarget.CATEGORY and banner.target_id:
            label = self.db.scalar(select(Category.name).where(Category.id == banner.target_id))
        elif banner.target_type is BannerTarget.PRODUCT and banner.target_id:
            label = self.db.scalar(select(Product.name).where(Product.id == banner.target_id))
        return AdminBannerOut(
            id=banner.id,
            title=banner.title,
            subtitle=banner.subtitle,
            image_key=banner.image_key,
            image_url=self._image(banner.image_key),
            target_type=banner.target_type.value,
            target_id=banner.target_id,
            target_label=label,
            sort_order=banner.sort_order,
            is_active=banner.is_active,
            starts_at=banner.starts_at,
            ends_at=banner.ends_at,
            is_live=is_live(banner, utcnow()),
        )

    # --- helpers ----------------------------------------------------------------------------

    def _image(self, key: str | None) -> str | None:
        return self.storage.url(key, width=BANNER_IMAGE_WIDTH) if key else None

    def _get(self, banner_id: uuid.UUID) -> Banner:
        banner = self.db.get(Banner, banner_id)
        if banner is None:
            raise AppError("NOT_FOUND", "Banner not found.", 404)
        return banner

    def _check_target(self, target_type: str, target_id: uuid.UUID | None) -> None:
        model = {"CATEGORY": Category, "PRODUCT": Product}.get(target_type)
        if model is not None and self.db.get(model, target_id) is None:
            raise AppError("NOT_FOUND", f"That {target_type.lower()} doesn't exist.", 404)
