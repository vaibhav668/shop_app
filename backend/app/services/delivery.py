"""Where the shop delivers. One rule, used by addresses, the checkout quote and (Phase 7) orders."""

from dataclasses import dataclass

from app.models import ShopSettings


@dataclass(frozen=True)
class DeliveryArea:
    pincodes: frozenset[str]
    # An empty list accepts every pincode only in local/test, so a fresh production shop that
    # hasn't set its area yet delivers nowhere rather than everywhere.
    open_when_unset: bool

    @classmethod
    def from_settings(cls, shop: ShopSettings, app_env: str) -> "DeliveryArea":
        return cls(
            pincodes=frozenset(shop.serviceable_pincodes or ()),
            open_when_unset=app_env in ("local", "test"),
        )

    def covers(self, pincode: str) -> bool:
        if not self.pincodes:
            return self.open_when_unset
        return pincode in self.pincodes
