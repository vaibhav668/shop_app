import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.storage import get_storage
from app.integrations.storage import StorageProvider
from app.schemas.admin_catalog import AdminBannerOut, BannerCreate, BannerUpdate, ReorderRequest
from app.services.banners import BannerService

router = APIRouter(prefix="/banners")


def get_service(
    db: Session = Depends(get_db), storage: StorageProvider = Depends(get_storage)
) -> BannerService:
    return BannerService(db, storage)


@router.get("", response_model=list[AdminBannerOut])
def list_banners(service: BannerService = Depends(get_service)) -> list[AdminBannerOut]:
    return service.list_all()


@router.post("", response_model=AdminBannerOut, status_code=status.HTTP_201_CREATED)
def create_banner(
    payload: BannerCreate, service: BannerService = Depends(get_service)
) -> AdminBannerOut:
    return service.create(payload)


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_banners(payload: ReorderRequest, service: BannerService = Depends(get_service)) -> None:
    service.reorder(payload.ids)


@router.patch("/{banner_id}", response_model=AdminBannerOut)
def update_banner(
    banner_id: uuid.UUID, payload: BannerUpdate, service: BannerService = Depends(get_service)
) -> AdminBannerOut:
    return service.update(banner_id, payload)


@router.delete("/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_banner(banner_id: uuid.UUID, service: BannerService = Depends(get_service)) -> None:
    service.delete(banner_id)
