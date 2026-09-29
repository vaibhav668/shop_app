from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class PushMessage:
    title: str
    body: str
    # Delivered to the app as strings; `route` tells it which screen to open on tap.
    data: dict[str, str] = field(default_factory=dict)


@dataclass
class PushResult:
    sent: int = 0
    # Tokens the push service says will never work again (app uninstalled, token rotated).
    invalid_tokens: list[str] = field(default_factory=list)


class PushProvider(Protocol):
    def send(self, tokens: list[str], message: PushMessage) -> PushResult: ...
