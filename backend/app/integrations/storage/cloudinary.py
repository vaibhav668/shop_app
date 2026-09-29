"""Cloudinary via its REST API (signed uploads), without the SDK.

Configured with CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>.
"""

import contextlib
import hashlib
import time
from urllib.parse import urlparse

import httpx

from app.core.errors import AppError


def _parse(cloudinary_url: str) -> tuple[str, str, str]:
    parsed = urlparse(cloudinary_url)
    if parsed.scheme != "cloudinary" or not (
        parsed.username and parsed.password and parsed.hostname
    ):
        raise ValueError("CLOUDINARY_URL must look like cloudinary://key:secret@cloud_name")
    return parsed.username, parsed.password, parsed.hostname


class CloudinaryStorage:
    def __init__(self, cloudinary_url: str, *, timeout: float = 20.0) -> None:
        self._api_key, self._api_secret, self._cloud = _parse(cloudinary_url)
        self._timeout = timeout

    def _public_id(self, key: str) -> str:
        return key.rsplit(".", 1)[0]

    def _sign(self, params: dict[str, str]) -> str:
        to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
        return hashlib.sha1(f"{to_sign}{self._api_secret}".encode()).hexdigest()

    def _signed(self, params: dict[str, str]) -> dict[str, str]:
        params = {**params, "timestamp": str(int(time.time()))}
        return {**params, "signature": self._sign(params), "api_key": self._api_key}

    def save(self, data: bytes, *, key: str, content_type: str) -> None:
        form = self._signed({"public_id": self._public_id(key), "overwrite": "true"})
        try:
            response = httpx.post(
                f"https://api.cloudinary.com/v1_1/{self._cloud}/image/upload",
                data=form,
                files={"file": (key.rsplit("/", 1)[-1], data, content_type)},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise AppError(
                "STORAGE_UNAVAILABLE", "Couldn't upload the image. Try again.", 503
            ) from exc
        if response.status_code >= 400:
            raise AppError("STORAGE_ERROR", "The image host rejected the upload.", 502)

    def delete(self, key: str) -> None:
        form = self._signed({"public_id": self._public_id(key)})
        # Best effort: an orphaned image costs storage, not correctness.
        with contextlib.suppress(httpx.HTTPError):
            httpx.post(
                f"https://api.cloudinary.com/v1_1/{self._cloud}/image/destroy",
                data=form,
                timeout=self._timeout,
            )

    def url(self, key: str, *, width: int | None = None) -> str:
        transform = "f_auto,q_auto" + (f",c_limit,w_{width}" if width else "")
        return f"https://res.cloudinary.com/{self._cloud}/image/upload/{transform}/{self._public_id(key)}"
