from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

MAX_PAGE_SIZE = 50


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
