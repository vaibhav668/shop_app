import type { OrderStatus } from '@/api/orders';
import type { BadgeTone } from '@/components/Badge';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Packing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  AWAITING_PAYMENT: 'neutral',
  PENDING: 'warning',
  CONFIRMED: 'success',
  PREPARING: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'solid',
  CANCELLED: 'danger',
};

/** The button that moves an order to this status: says what the shopkeeper is doing. */
export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Accept order',
  PREPARING: 'Start packing',
  OUT_FOR_DELIVERY: 'Send for delivery',
  DELIVERED: 'Mark delivered',
};

/** Tabs on the orders page, in the order work flows through the shop. */
export const STATUS_TABS: { status?: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'New' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PREPARING', label: 'Packing' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'CANCELLED', label: 'Cancelled' },
  { label: 'All' },
];

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
