import re
import unicodedata
from collections.abc import Callable


def slugify(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:80] or "item"


def unique_slug(value: str, taken: Callable[[str], bool]) -> str:
    """slugify(value), suffixed -2, -3, … until `taken` says it's free."""
    base = slugify(value)
    candidate, n = base, 2
    while taken(candidate):
        candidate = f"{base}-{n}"
        n += 1
    return candidate
