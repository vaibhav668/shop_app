/**
 * Instant, client-side cart estimates used ONLY while a change is in flight. They mirror the
 * server's PricingService formula so numbers don't jump; the server's response then replaces
 * them, and checkout always charges the server's figures.
 */
import type { Cart, CartLine, DeliveryRules } from '@/api/cart';
import type { ProductCard } from '@/api/catalog';

export const MAX_LINE_QUANTITY = 50;

export function emptyCart(rules: DeliveryRules): Cart {
  return withTotals([], rules);
}

export function maxQuantityFor(product: ProductCard): number {
  return Math.min(product.max_per_order ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
}

export function quantityOf(cart: Cart | undefined, productId: string): number {
  return cart?.lines.find((l) => l.product.id === productId)?.quantity ?? 0;
}

/** What checkout asks the server to price: the cart as shown, quantities as asked. */
export function checkoutItems(cart: Cart | undefined): { product_id: string; quantity: number }[] {
  return (cart?.lines ?? []).map((l) => ({ product_id: l.product.id, quantity: l.quantity }));
}

export function applyQuantity(cart: Cart, product: ProductCard, quantity: number): Cart {
  const existing = cart.lines.find((l) => l.product.id === product.id);
  let lines: CartLine[];
  if (quantity <= 0) {
    lines = cart.lines.filter((l) => l.product.id !== product.id);
  } else if (existing) {
    lines = cart.lines.map((l) =>
      l.product.id === product.id ? optimisticLine(l.product, quantity) : l,
    );
  } else {
    lines = [...cart.lines, optimisticLine(product, quantity)];
  }
  return withTotals(lines, cart.rules);
}

function optimisticLine(product: ProductCard, quantity: number): CartLine {
  return {
    product,
    quantity,
    available_quantity: quantity,
    line_total_paise: product.price_paise * quantity,
    issue: null,
  };
}

export function withTotals(lines: CartLine[], rules: DeliveryRules): Cart {
  const subtotal = lines.reduce((sum, l) => sum + l.line_total_paise, 0);
  const fee =
    subtotal === 0 || subtotal >= rules.free_delivery_above_paise ? 0 : rules.delivery_fee_paise;
  return {
    lines,
    item_count: lines.reduce((sum, l) => sum + l.available_quantity, 0),
    subtotal_paise: subtotal,
    delivery_fee_paise: fee,
    total_paise: subtotal + fee,
    free_delivery_remaining_paise: subtotal
      ? Math.max(0, rules.free_delivery_above_paise - subtotal)
      : 0,
    min_order_remaining_paise: Math.max(0, rules.min_order_paise - subtotal),
    has_issues: lines.some((l) => l.issue !== null),
    rules,
  };
}
