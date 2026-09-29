from functools import lru_cache
from pathlib import Path

from fastapi import BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import SessionLocal
from app.dependencies.db import get_db
from app.integrations.push import FakePushProvider, FcmPushProvider, PushProvider
from app.services.notifications import Notifier, PushDelivery, SessionFactory

_fake = FakePushProvider()


@lru_cache
def _fcm(credentials_file: Path) -> FcmPushProvider:
    # One per process: it caches the OAuth access token between pushes.
    return FcmPushProvider(credentials_file)


def get_push_provider(settings: Settings = Depends(get_settings)) -> PushProvider:
    if settings.push_provider == "fcm" and settings.firebase_credentials_file:
        return _fcm(settings.firebase_credentials_file)
    return _fake


def get_session_factory() -> SessionFactory:
    """Pushes run after the request's session is closed, so they open their own."""
    return SessionLocal


def get_notifier(
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    push: PushProvider = Depends(get_push_provider),
    session_factory: SessionFactory = Depends(get_session_factory),
) -> Notifier:
    return Notifier(db, background, PushDelivery(session_factory, push))
