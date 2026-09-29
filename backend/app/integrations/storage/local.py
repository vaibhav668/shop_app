from pathlib import Path


class LocalStorage:
    """Development storage: files under backend/media, served by the API at /media."""

    def __init__(self, root: Path, base_url: str) -> None:
        self._root = root
        # Built from the incoming request, so a phone on the LAN gets LAN-reachable URLs.
        self._base_url = base_url.rstrip("/")

    def _path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if self._root.resolve() not in path.parents:
            raise ValueError("Invalid storage key.")
        return path

    def save(self, data: bytes, *, key: str, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def url(self, key: str, *, width: int | None = None) -> str:
        return f"{self._base_url}/media/{key}"
