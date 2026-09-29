from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models import User
from app.schemas.auth import DeviceRegistration, UpdateMeRequest, UserOut
from app.services.users import UserService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("", response_model=UserOut)
def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return UserService(db).update_profile(user, name=payload.name, phone=payload.phone)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    UserService(db).delete_account(user)


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(
    payload: DeviceRegistration,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    UserService(db).register_device(user, payload.token, payload.platform)


@router.delete("/devices/{token}", status_code=status.HTTP_204_NO_CONTENT)
def remove_device(
    token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    UserService(db).remove_device(user, token)
