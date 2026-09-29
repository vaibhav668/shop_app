import type { DeliveryRules } from '@/api/cart';
import type { ProductCard } from '@/api/catalog';
import {
  applyQuantity,
  checkoutItems,
  emptyCart,
  maxQuantityFor,
  quantityOf,
  withTotals,
} from '@/features/cart/cartMath';

const rules: DeliveryRules = {
  delivery_fee_paise: 2000,
  free_delivery_above_paise: 29900,
  min_order_paise: 9900,
};

function product(id: string, price: number, extra: Partial<ProductCard> = {}): ProductCard {
  return {
    id,
    name: id,
    unit_label: '1 pc',
    price_paise: price,
    mrp_paise: price,
    discount_percent: 0,
    image_url: null,
    is_available: true,
    stock_hint: 'IN_STOCK',
    max_per_order: null,
    ...extra,
  };
}

const milk = product('milk', 2800);
const atta = product('atta', 24500);

describe('applyQuantity', () => {
  it('adds, updates and removes lines', () => {
    let cart = applyQuantity(emptyCart(rules), milk, 2);
    expect(quantityOf(cart, 'milk')).toBe(2);
    cart = applyQuantity(cart, milk, 3);
    expect(cart.lines).toHaveLength(1);
    expect(quantityOf(cart, 'milk')).toBe(3);
    cart = applyQuantity(cart, milk, 0);
    expect(cart.lines).toHaveLength(0);
  });

  it('keeps line order stable when updating', () => {
    let cart = applyQuantity(emptyCart(rules), milk, 1);
    cart = applyQuantity(cart, atta, 1);
    cart = applyQuantity(cart, milk, 5);
    expect(cart.lines.map((l) => l.product.id)).toEqual(['milk', 'atta']);
  });

  it('does not mutate the previous cart (safe for rollback)', () => {
    const before = applyQuantity(emptyCart(rules), milk, 1);
    applyQuantity(before, milk, 4);
    expect(quantityOf(before, 'milk')).toBe(1);
  });
});

describe('estimated totals match the server formula', () => {
  it('charges delivery below the free threshold and nudges', () => {
    const cart = applyQuantity(emptyCart(rules), milk, 2);
    expect(cart.subtotal_paise).toBe(5600);
    expect(cart.delivery_fee_paise).toBe(2000);
    expect(cart.total_paise).toBe(7600);
    expect(cart.free_delivery_remaining_paise).toBe(29900 - 5600);
    expect(cart.min_order_remaining_paise).toBe(9900 - 5600);
  });

  it('delivers free at or above the threshold', () => {
    const cart = applyQuantity(applyQuantity(emptyCart(rules), atta, 1), milk, 2);
    expect(cart.subtotal_paise).toBe(30100);
    expect(cart.delivery_fee_paise).toBe(0);
    expect(cart.free_delivery_remaining_paise).toBe(0);
  });

  it('an empty cart owes nothing', () => {
    expect(withTotals([], rules)).toMatchObject({ total_paise: 0, delivery_fee_paise: 0 });
  });
});

describe('checkoutItems', () => {
  it('sends product ids and asked quantities only, never prices', () => {
    const cart = applyQuantity(applyQuantity(emptyCart(rules), milk, 2), atta, 1);
    expect(checkoutItems(cart)).toEqual([
      { product_id: 'milk', quantity: 2 },
      { product_id: 'atta', quantity: 1 },
    ]);
    expect(checkoutItems(undefined)).toEqual([]);
  });
});

describe('maxQuantityFor', () => {
  it('respects the per-order cap and the hard cap of 50', () => {
    expect(maxQuantityFor(product('offer', 100, { max_per_order: 2 }))).toBe(2);
    expect(maxQuantityFor(milk)).toBe(50);
  });
});
