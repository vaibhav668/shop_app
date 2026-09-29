from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.dependencies.auth import CurrentSession, get_current_session, get_google_verifier
from app.dependencies.db import get_db
from app.integrations.google_auth import GoogleIdentity, GoogleVerifier
from app.models import SessionClient
from app.schemas.auth import (
    AuthResponse,
    DevSignInRequest,
    GoogleSignInRequest,
    LogoutRequest,
    RefreshRequest,
    UserOut,
)
from app.services.auth import DEV_SUB_PREFIX, AuthResult, AuthService

REFRESH_COOKIE = "bb_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

router = APIRouter(prefix="/auth", tags=["auth"])


def _respond(result: AuthResult, response: Response, settings: Settings) -> AuthResponse:
    body = AuthResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
        user=UserOut.model_validate(result.user),
        is_new_user=result.is_new_user,
    )
    if result.client is SessionClient.ADMIN:
        # Browser client: keep the long-lived token out of JavaScript's reach.
        response.set_cookie(
            REFRESH_COOKIE,
            result.refresh_token,
            max_age=settings.refresh_token_ttl_days * 86400,
            path=REFRESH_COOKIE_PATH,
            httponly=True,
            secure=settings.admin_cookie_secure,
            samesite="strict",
        )
    else:
        body.refresh_token = result.refresh_token
    return body


@router.post("/google", response_model=AuthResponse, response_model_exclude_none=True)
def sign_in_with_google(
    payload: GoogleSignInRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    verifier: GoogleVerifier = Depends(get_google_verifier),
) -> AuthResponse:
    identity = verifier.verify(payload.id_token)
    result = AuthService(db, settings).sign_in(
        identity, payload.client, request.headers.get("user-agent")
    )
    return _respond(result, response, settings)


@router.post("/refresh", response_model=AuthResponse, response_model_exclude_none=True)
def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    token = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise AppError("UNAUTHENTICATED", "Please sign in.", status_code=401)
    result = AuthService(db, settings).refresh(token)
    return _respond(result, response, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    payload: LogoutRequest | None = None,
    current: CurrentSession = Depends(get_current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    AuthService(db, settings).sign_out(
        current.user, current.claims.session_id, payload.device_token if payload else None
    )
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


# Mounted only when DEV_LOGIN_ENABLED=true in local/test (see main.py and Settings validation).
dev_router = APIRouter(prefix="/auth", tags=["auth (dev only)"])


@dev_router.post("/dev-login", response_model=AuthResponse, response_model_exclude_none=True)
def dev_login(
    payload: DevSignInRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    email = payload.email.lower()
    identity = GoogleIdentity(
        sub=f"{DEV_SUB_PREFIX}{email}",
        email=email,
        name=payload.name or email.split("@")[0],
        picture=None,
    )
    result = AuthService(db, settings).sign_in(
        identity, payload.client, request.headers.get("user-agent")
    )
    return _respond(result, response, settings)
