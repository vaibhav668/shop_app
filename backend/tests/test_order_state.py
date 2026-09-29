"""Every allowed and every forbidden order transition, for each kind of actor."""

import itertools

import pytest

from app.models import OrderStatus
from app.services.order_state import TRANSITIONS, ActorKind, allowed_for

S = OrderStatus

ADMIN_EDGES = {
    (S.AWAITING_PAYMENT, S.CANCELLED),
    (S.PENDING, S.CONFIRMED),
    (S.PENDING, S.CANCELLED),
    (S.CONFIRMED, S.PREPARING),
    (S.CONFIRMED, S.CANCELLED),
    (S.PREPARING, S.OUT_FOR_DELIVERY),
    (S.PREPARING, S.CANCELLED),
    (S.OUT_FOR_DELIVERY, S.DELIVERED),
    (S.OUT_FOR_DELIVERY, S.CANCELLED),
}
CUSTOMER_EDGES = {(S.AWAITING_PAYMENT, S.CANCELLED), (S.PENDING, S.CANCELLED)}
SYSTEM_EDGES = ADMIN_EDGES | {(S.AWAITING_PAYMENT, S.PENDING)}

ALL_PAIRS = list(itertools.product(S, S))


@pytest.mark.parametrize(("current", "to"), ALL_PAIRS)
def test_admin(current: OrderStatus, to: OrderStatus) -> None:
    assert (to in allowed_for(ActorKind.ADMIN, current)) == ((current, to) in ADMIN_EDGES)


@pytest.mark.parametrize(("current", "to"), ALL_PAIRS)
def test_customer(current: OrderStatus, to: OrderStatus) -> None:
    assert (to in allowed_for(ActorKind.CUSTOMER, current)) == ((current, to) in CUSTOMER_EDGES)


@pytest.mark.parametrize(("current", "to"), ALL_PAIRS)
def test_system(current: OrderStatus, to: OrderStatus) -> None:
    assert (to in allowed_for(ActorKind.SYSTEM, current)) == ((current, to) in SYSTEM_EDGES)


def test_finished_orders_never_move() -> None:
    for actor in ActorKind:
        assert allowed_for(actor, S.DELIVERED) == frozenset()
        assert allowed_for(actor, S.CANCELLED) == frozenset()


def test_table_covers_every_status() -> None:
    assert set(TRANSITIONS) == set(S)
