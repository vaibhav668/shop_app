"""Profile changes, device registration and account deletion for the signed-in user."""

from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models import DeviceToken, User
from app.repositories import users as repo


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def update_profile(self, user: User, *, name: str | None, phone: str | None) -> User:
        if name is not None:
            user.name = name
        if phone is not None:
            user.phone = phone
        self.db.commit()
        self.db.refresh(user)
        return user

    def register_device(self, user: User, token: str, platform: str) -> None:
        device = repo.get_device_token(self.db, token)
        now = utcnow()
        if device is None:
            self.db.add(
                DeviceToken(user_id=user.id, token=token, platform=platform, last_seen_at=now)
            )
        else:
            # A token moves with the device, e.g. when a different person signs in on it.
            device.user_id = user.id
            device.platform = platform
            device.last_seen_at = now
        self.db.commit()

    def remove_device(self, user: User, token: str) -> None:
        repo.delete_device_token(self.db, user.id, token)
        self.db.commit()

    def delete_account(self, user: User) -> None:
        """Anonymise personal data and end every session. Order records (Phase 7) are kept for
        accounting and will block deletion while an order is still active."""
        now = utcnow()
        marker = f"deleted:{user.id}"
        user.google_sub = marker
        user.email = f"{marker}@deleted.invalid"
        user.name = "Deleted user"
        user.phone = None
        user.avatar_url = None
        user.is_active = False
        user.deleted_at = now
        repo.revoke_all_sessions(self.db, user.id, now)
        repo.delete_all_device_tokens(self.db, user.id)
        self.db.commit()
