import type { BadgeTone } from '@/components/ui';
import type { OrderDetail, OrderStatus } from '@/api/orders';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING: 'Placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Being packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  AWAITING_PAYMENT: 'warning',
  PENDING: 'neutral',
  CONFIRMED: 'success',
  PREPARING: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'successSolid',
  CANCELLED: 'danger',
};

/** One friendly line under the status on the order screen. */
export const STATUS_MESSAGE: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Waiting for your payment to be confirmed.',
  PENDING: 'The shop will confirm your order shortly.',
  CONFIRMED: 'The shop has accepted your order.',
  PREPARING: 'Your items are being packed.',
  OUT_FOR_DELIVERY: 'Your order is on its way.',
  DELIVERED: 'Delivered. Enjoy!',
  CANCELLED: 'This order was cancelled.',
};

export const FINISHED: ReadonlySet<OrderStatus> = new Set(['DELIVERED', 'CANCELLED']);

const JOURNEY: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export type TimelineStep = {
  status: OrderStatus;
  label: string;
  at: string | null; // when it happened; null for steps still to come
  state: 'done' | 'current' | 'upcoming' | 'cancelled';
};

/**
 * The customer timeline: Placed → Confirmed → Being packed → Out for delivery → Delivered.
 * Reached steps carry their time; a cancelled order stops at the step it reached, then shows
 * "Cancelled".
 */
export function buildTimeline(order: Pick<OrderDetail, 'status' | 'timeline'>): TimelineStep[] {
  const reachedAt = new Map(order.timeline.map((t) => [t.status, t.at]));
  const cancelled = order.status === 'CANCELLED';
  const currentIndex = JOURNEY.indexOf(order.status);

  const steps: TimelineStep[] = [];
  for (const [i, status] of JOURNEY.entries()) {
    const at = reachedAt.get(status) ?? null;
    if (cancelled && !at) break;
    steps.push({
      status,
      label: STATUS_LABEL[status],
      at,
      state: cancelled || i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
    });
  }
  if (cancelled) {
    steps.push({
      status: 'CANCELLED',
      label: STATUS_LABEL.CANCELLED,
      at: reachedAt.get('CANCELLED') ?? null,
      state: 'cancelled',
    });
  }
  // A delivered order's last step is done, not "in progress".
  if (order.status === 'DELIVERED') steps[steps.length - 1].state = 'done';
  return steps;
}

/** "2 Oct, 7:45 pm" in the phone's timezone. */
export function formatOrderTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time.toLowerCase()}`;
}

/**
 * A random v4 UUID for the order's idempotency key. It only has to be unique per checkout, not
 * secret, so Math.random is enough (and needs no native module).
 */
export function newIdempotencyKey(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
