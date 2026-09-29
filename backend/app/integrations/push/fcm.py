"""Firebase Cloud Messaging over its HTTP v1 API, authenticated with a service-account key.
Uses google-auth (already needed for Google sign-in) and httpx instead of the heavy
firebase-admin SDK."""

import json
import logging
import threading
from pathlib import Path

import google.auth.transport.requests
import httpx
from google.oauth2 import service_account

from app.integrations.push.base import PushMessage, PushResult

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
ANDROID_CHANNEL = "orders"  # must match the channel the app creates
# FCM error codes that mean the token is dead and should be forgotten.
DEAD_TOKEN_ERRORS = {"UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"}


class FcmPushProvider:
    def __init__(self, credentials_file: Path, *, timeout: float = 10.0) -> None:
        info = json.loads(Path(credentials_file).read_text(encoding="utf-8"))
        self._project_id = info["project_id"]
        self._credentials = service_account.Credentials.from_service_account_info(
            info, scopes=[SCOPE]
        )
        self._lock = threading.Lock()
        self._timeout = timeout

    @property
    def _endpoint(self) -> str:
        return f"https://fcm.googleapis.com/v1/projects/{self._project_id}/messages:send"

    def _access_token(self) -> str:
        # The token lasts an hour; refresh only when needed, one thread at a time.
        with self._lock:
            if not self._credentials.valid:
                self._credentials.refresh(google.auth.transport.requests.Request())
            return self._credentials.token

    def send(self, tokens: list[str], message: PushMessage) -> PushResult:
        result = PushResult()
        if not tokens:
            return result
        headers = {"Authorization": f"Bearer {self._access_token()}"}
        with httpx.Client(timeout=self._timeout) as http:
            for token in tokens:
                payload = {
                    "message": {
                        "token": token,
                        "notification": {"title": message.title, "body": message.body},
                        "data": message.data,
                        "android": {
                            "priority": "HIGH",
                            "notification": {"channel_id": ANDROID_CHANNEL},
                        },
                    }
                }
                try:
                    response = http.post(self._endpoint, json=payload, headers=headers)
                except httpx.HTTPError:
                    logger.warning("FCM request failed; will not retry this push", exc_info=True)
                    continue
                if response.is_success:
                    result.sent += 1
                elif _error_status(response) in DEAD_TOKEN_ERRORS:
                    result.invalid_tokens.append(token)
                else:
                    logger.warning(
                        "FCM rejected a push: %s %s", response.status_code, response.text
                    )
        return result


def _error_status(response: httpx.Response) -> str | None:
    try:
        error = response.json()["error"]
    except (ValueError, KeyError, TypeError):
        return None
    for detail in error.get("details", []):
        if code := detail.get("errorCode"):
            return code
    return error.get("status")
