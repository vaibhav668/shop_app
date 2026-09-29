from typing import Protocol


class StorageProvider(Protocol):
    """Where product and category photos live. Rows store only the returned key."""

    def save(self, data: bytes, *, key: str, content_type: str) -> None: ...

    def delete(self, key: str) -> None: ...

    def url(self, key: str, *, width: int | None = None) -> str:
        """Public URL for a key; `width` asks for a resized variant where supported."""
        ...
