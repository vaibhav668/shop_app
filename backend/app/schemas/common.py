from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

MAX_PAGE_SIZE = 50


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


def blank_to_none(value: object) -> object:
    """For optional text fields: a form's empty input means "not set"."""
    if isinstance(value, str) and not value.strip():
        return None
    return value
