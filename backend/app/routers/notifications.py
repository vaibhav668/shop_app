import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models import User
from app.schemas.common import MAX_PAGE_SIZE, Page
from app.services.notifications import mark_all_read, notifications_page, unread_count

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str
    # {"order_id", "status", "route"}: `route` is the screen to open when tapped.
    data: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class UnreadCountOut(BaseModel):
    count: int


@router.get("", response_model=Page[NotificationOut])
def list_notifications(
    limit: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[NotificationOut]:
    """Newest first."""
    items, total = notifications_page(db, user.id, limit=limit, offset=offset)
    return Page(
        items=[NotificationOut.model_validate(n, from_attributes=True) for n in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UnreadCountOut:
    return UnreadCountOut(count=unread_count(db, user.id))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    mark_all_read(db, user.id)
