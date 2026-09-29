"""Real concurrent transactions on PostgreSQL (no rollback wrapper): the row locks are what is
being tested, so every thread commits for real, and the fixture cleans up afterwards."""

import threading
import uuid
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from sqlalchemy import Engine, create_engine, delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import (
    Address,
    Cart,
    Category,
    InventoryMovement,
    Order,
    PaymentMethod,
    Product,
    User,
)
from app.schemas.checkout import CheckoutItem
from app.schemas.order import PlaceOrderRequest
from app.services.addresses import AddressService
from app.services.delivery import DeliveryArea
from app.services.orders import OrderService
from tests.factories import make_address, make_category, make_product, make_user

AREA = DeliveryArea(pincodes=frozenset(), open_when_unset=True)
PRICE = 15000  # ₹150: one unit clears the ₹99 minimum and pays ₹20 delivery


@dataclass
class World:
    product_id: uuid.UUID
    shoppers: list[tuple[uuid.UUID, uuid.UUID]]  # (user_id, address_id)


@pytest.fixture
def world(db_engine: Engine) -> Iterator[World]:
    with Session(db_engine) as db:
        category = make_category(db)
        product = make_product(db, category, price_paise=PRICE, stock_quantity=5)
        shoppers = []
        for _ in range(20):
            user = make_user(db)
            shoppers.append((user.id, make_address(db, user).id))
        db.commit()
        state = World(product.id, shoppers)
        category_id = category.id
    yield state
    with Session(db_engine) as db:
        user_ids = [u for u, _ in state.shoppers]
        db.execute(
            delete(InventoryMovement).where(InventoryMovement.product_id == state.product_id)
        )
        db.execute(delete(Order).where(Order.user_id.in_(user_ids)))
        db.execute(delete(Cart).where(Cart.user_id.in_(user_ids)))
        db.execute(delete(Address).where(Address.user_id.in_(user_ids)))
        db.execute(delete(Product).where(Product.id == state.product_id))
        db.execute(delete(Category).where(Category.id == category_id))
        db.execute(delete(User).where(User.id.in_(user_ids)))
        db.commit()


def request(address_id: uuid.UUID, product_id: uuid.UUID, key: uuid.UUID) -> PlaceOrderRequest:
    return PlaceOrderRequest(
        address_id=address_id,
        payment_method=PaymentMethod.COD,
        items=[CheckoutItem(product_id=product_id, quantity=1)],
        idempotency_key=key,
        expected_total_paise=PRICE + 2000,
    )


def run_together(engine: Engine, jobs: list[tuple[uuid.UUID, PlaceOrderRequest]]) -> list[object]:
    """Starts every job at the same instant; returns each job's order id or error code."""
    # Every thread holds a connection while it waits at the barrier, so the pool must fit them
    # all (the default pool would leave some threads stuck before the barrier).
    racing = create_engine(engine.url, pool_size=len(jobs), max_overflow=0)
    barrier = threading.Barrier(len(jobs), timeout=20)
    results: list[object] = [None] * len(jobs)

    def worker(i: int, user_id: uuid.UUID, req: PlaceOrderRequest) -> None:
        try:
            with Session(racing) as db:
                user = db.get(User, user_id)
                service = OrderService(db, AddressService(db, AREA))
                barrier.wait()
                try:
                    order, _ = service.place(user, req)
                    results[i] = order.id
                except AppError as exc:
                    results[i] = exc.code
        except Exception as exc:  # surfaced in the assertion instead of hanging the run
            barrier.abort()
            results[i] = repr(exc)

    threads = [
        threading.Thread(target=worker, args=(i, user_id, req))
        for i, (user_id, req) in enumerate(jobs)
    ]
    try:
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)
    finally:
        racing.dispose()
    return results


def test_twenty_shoppers_race_for_five_units(db_engine: Engine, world: World) -> None:
    jobs = [
        (user_id, request(address_id, world.product_id, uuid.uuid4()))
        for user_id, address_id in world.shoppers
    ]
    results = run_together(db_engine, jobs)

    outcomes = Counter("ORDER" if isinstance(r, uuid.UUID) else r for r in results)
    assert outcomes == {"ORDER": 5, "OUT_OF_STOCK": 15}
    with Session(db_engine) as db:
        assert db.get(Product, world.product_id).stock_quantity == 0
        movements = db.scalars(
            select(InventoryMovement.delta).where(InventoryMovement.product_id == world.product_id)
        ).all()
        assert movements == [-1] * 5


def test_double_submit_places_one_order(db_engine: Engine, world: World) -> None:
    user_id, address_id = world.shoppers[0]
    same = request(address_id, world.product_id, uuid.uuid4())
    results = run_together(db_engine, [(user_id, same)] * 4)

    assert all(isinstance(r, uuid.UUID) for r in results), results
    assert len(set(results)) == 1
    with Session(db_engine) as db:
        assert db.get(Product, world.product_id).stock_quantity == 4
        assert len(db.scalars(select(Order.id).where(Order.user_id == user_id)).all()) == 1
