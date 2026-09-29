"""Validates uploaded photos and re-encodes them, so nothing uploaded is served as-is."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 25_000_000  # guards against decompression bombs
MAX_SIDE = 1600
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

OUTPUT_EXTENSION = "webp"
OUTPUT_CONTENT_TYPE = "image/webp"


def _invalid(message: str) -> AppError:
    return AppError("INVALID_IMAGE", message, status_code=400)


def normalise_image(data: bytes) -> bytes:
    """Returns the photo as WebP, at most MAX_SIDE px on its longest side, EXIF-rotated."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise _invalid("Photos must be 5 MB or smaller.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise _invalid("Use a JPEG, PNG or WebP photo.")
            if probe.width * probe.height > MAX_PIXELS:
                raise _invalid("That photo is too large. Try a smaller one.")
            probe.verify()
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=85, method=4)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise _invalid("That file isn't a readable photo.") from exc
