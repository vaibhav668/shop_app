import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models import SessionClient, UserRole

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
IndianMobile = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[6-9]\d{9}$")]


class GoogleSignInRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=4096)
    client: SessionClient = SessionClient.MOBILE


class DevSignInRequest(BaseModel):
    email: EmailStr
    name: Name | None = None
    client: SessionClient = SessionClient.MOBILE


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=256)


class LogoutRequest(BaseModel):
    device_token: str | None = Field(default=None, max_length=4096)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    phone: str | None
    role: UserRole
    needs_onboarding: bool


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    # Omitted for the admin web client, which receives it as an httpOnly cookie instead.
    refresh_token: str | None = None
    user: UserOut
    is_new_user: bool


class UpdateMeRequest(BaseModel):
    name: Name | None = None
    phone: IndianMobile | None = None


class DeviceRegistration(BaseModel):
    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["android"] = "android"
