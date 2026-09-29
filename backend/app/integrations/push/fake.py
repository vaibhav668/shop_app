import logging

from app.integrations.push.base import PushMessage, PushResult

logger = logging.getLogger(__name__)

# Tokens starting with this are reported invalid, so tests can exercise token pruning.
INVALID_TOKEN_PREFIX = "invalid-"


class FakePushProvider:
    """Local/test stand-in for FCM: records and logs pushes instead of sending them."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, PushMessage]] = []

    def send(self, tokens: list[str], message: PushMessage) -> PushResult:
        result = PushResult()
        for token in tokens:
            if token.startswith(INVALID_TOKEN_PREFIX):
                result.invalid_tokens.append(token)
                continue
            self.sent.append((token, message))
            result.sent += 1
        logger.info("push (fake) to %d device(s): %s", result.sent, message.title)
        return result
