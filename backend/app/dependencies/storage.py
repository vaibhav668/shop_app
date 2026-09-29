from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.integrations.storage import CloudinaryStorage, LocalStorage, StorageProvider


def get_storage(request: Request, settings: Settings = Depends(get_settings)) -> StorageProvider:
    if settings.storage_provider == "cloudinary":
        return CloudinaryStorage(settings.cloudinary_url)
    return LocalStorage(settings.media_dir, str(request.base_url))
