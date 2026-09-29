import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import DeviceToken, User, UserSession


def get_user(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_user_by_google_sub(db: Session, google_sub: str) -> User | None:
    return db.scalar(select(User).where(User.google_sub == google_sub))


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_session(db: Session, session_id: uuid.UUID) -> UserSession | None:
    return db.get(UserSession, session_id)


def get_session_by_token_hash(
    db: Session, token_hash: str, *, lock: bool = False
) -> UserSession | None:
    stmt = select(UserSession).where(UserSession.refresh_token_hash == token_hash)
    if lock:
        stmt = stmt.with_for_update()
    return db.scalar(stmt)


def get_session_by_previous_hash(db: Session, token_hash: str) -> UserSession | None:
    return db.scalar(select(UserSession).where(UserSession.previous_token_hash == token_hash))


def revoke_all_sessions(db: Session, user_id: uuid.UUID, when) -> None:
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=when)
    )


def get_device_token(db: Session, token: str) -> DeviceToken | None:
    return db.scalar(select(DeviceToken).where(DeviceToken.token == token))


def delete_device_token(db: Session, user_id: uuid.UUID, token: str) -> None:
    db.execute(
        delete(DeviceToken).where(DeviceToken.user_id == user_id, DeviceToken.token == token)
    )


def delete_all_device_tokens(db: Session, user_id: uuid.UUID) -> None:
    db.execute(delete(DeviceToken).where(DeviceToken.user_id == user_id))
