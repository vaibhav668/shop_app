import io

import pytest
from PIL import Image

from app.core.errors import AppError
from app.integrations.storage import CloudinaryStorage, LocalStorage
from app.utils.images import MAX_SIDE, normalise_image
from app.utils.slugs import slugify, unique_slug


def encode(size: tuple[int, int], fmt: str = "JPEG") -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (200, 120, 20)).save(out, format=fmt)
    return out.getvalue()


def test_large_photos_are_downscaled() -> None:
    result = Image.open(io.BytesIO(normalise_image(encode((4000, 2000)))))
    assert result.format == "WEBP"
    assert max(result.size) == MAX_SIDE


def test_rejects_unsupported_format() -> None:
    with pytest.raises(AppError, match="JPEG, PNG or WebP"):
        normalise_image(encode((10, 10), "GIF"))


def test_rejects_oversized_upload() -> None:
    with pytest.raises(AppError, match="5 MB"):
        normalise_image(b"x" * (5 * 1024 * 1024 + 1))


def test_local_storage_refuses_path_traversal(tmp_path) -> None:
    storage = LocalStorage(tmp_path, "http://x")
    with pytest.raises(ValueError):
        storage.save(b"x", key="../../escape.txt", content_type="text/plain")


def test_cloudinary_urls_and_signature() -> None:
    storage = CloudinaryStorage("cloudinary://key:secret@demo")
    assert storage.url("catalog/abc.webp", width=400) == (
        "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_400/catalog/abc"
    )
    # Cloudinary's documented algorithm: sha1 of sorted params + secret.
    import hashlib

    expected = hashlib.sha1(b"public_id=catalog/abc&timestamp=1secret").hexdigest()
    assert storage._sign({"timestamp": "1", "public_id": "catalog/abc"}) == expected


def test_cloudinary_url_must_be_well_formed() -> None:
    with pytest.raises(ValueError):
        CloudinaryStorage("https://nope")


def test_slugs() -> None:
    assert slugify("Dairy & Eggs") == "dairy-eggs"
    assert slugify("Café Crème 500 ml") == "cafe-creme-500-ml"
    taken = {"milk", "milk-2"}
    assert unique_slug("Milk", taken.__contains__) == "milk-3"
