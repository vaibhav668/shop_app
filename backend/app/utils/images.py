"""Validates uploaded photos and re-encodes them, so nothing uploaded is served as-is."""

import io

from PIL import Image, ImageChops, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 25_000_000  # guards against decompression bombs
MAX_SIDE = 1600
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

OUTPUT_EXTENSION = "webp"
OUTPUT_CONTENT_TYPE = "image/webp"

# Product photos: one square size on white, the product filling most of the frame.
SQUARE_SIDE = 1000
SQUARE_MARGIN = 0.08  # of the side, on every edge
TRIM_TOLERANCE = 24  # how far from the background colour still counts as background


def _invalid(message: str) -> AppError:
    return AppError("INVALID_IMAGE", message, status_code=400)


def _open_checked(data: bytes) -> Image.Image:
    """Opens an upload after checking size, type and pixel count; EXIF-rotated."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise _invalid("Photos must be 5 MB or smaller.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise _invalid("Use a JPEG, PNG or WebP photo.")
            if probe.width * probe.height > MAX_PIXELS:
                raise _invalid("That photo is too large. Try a smaller one.")
            probe.verify()
        img = Image.open(io.BytesIO(data))
        img.load()
        return ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise _invalid("That file isn't a readable photo.") from exc


def _webp(img: Image.Image) -> bytes:
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=85, method=4)
    return out.getvalue()


def normalise_image(data: bytes) -> bytes:
    """Returns the photo as WebP, at most MAX_SIDE px on its longest side, EXIF-rotated."""
    img = _open_checked(data)
    img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    return _webp(img)


def _on_white(img: Image.Image) -> Image.Image:
    """Flattens any transparency onto white."""
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        white = Image.new("RGB", rgba.size, (255, 255, 255))
        white.paste(rgba, mask=rgba.getchannel("A"))
        return white
    return img.convert("RGB")


def _trim_plain_border(img: Image.Image) -> Image.Image:
    """Crops away a plain border (a table or wall around the product), if there is one."""
    background = Image.new("RGB", img.size, img.getpixel((0, 0)))
    diff = ImageChops.difference(img, background).convert("L")
    mask = diff.point(lambda v: 255 if v > TRIM_TOLERANCE else 0)
    box = mask.getbbox()
    if box is None:
        return img
    left, top, right, bottom = box
    # Only trust the crop when it keeps a real subject (not a speck of noise).
    if (right - left) * (bottom - top) < 0.01 * img.width * img.height:
        return img
    return img.crop(box)


def square_product_photo(data: bytes) -> bytes:
    """
    A product photo as a SQUARE_SIDE WebP on white: plain borders trimmed, the product centred
    with an even margin. Every product tile in the app then lines up, whatever the camera did.
    """
    img = _trim_plain_border(_on_white(_open_checked(data)))
    inner = round(SQUARE_SIDE * (1 - 2 * SQUARE_MARGIN))
    # Fit the product to the frame both ways: shrink big photos, enlarge small trimmed ones.
    img = ImageOps.contain(img, (inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (SQUARE_SIDE, SQUARE_SIDE), (255, 255, 255))
    canvas.paste(img, ((SQUARE_SIDE - img.width) // 2, (SQUARE_SIDE - img.height) // 2))
    return _webp(canvas)
