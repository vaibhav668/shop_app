import type { OrderDetail } from '@/api/orders';
import { buildTimeline, newIdempotencyKey } from '@/features/orders/orderStatus';

type T = Pick<OrderDetail, 'status' | 'timeline'>;

const at = (minute: number) => `2026-10-02T10:${String(minute).padStart(2, '0')}:00Z`;

function states(order: T) {
  return buildTimeline(order).map((s) => `${s.status}:${s.state}${s.at ? '@' : ''}`);
}

describe('buildTimeline', () => {
  it('a new order: placed is current, the rest upcoming', () => {
    expect(states({ status: 'PENDING', timeline: [{ status: 'PENDING', at: at(0) }] })).toEqual([
      'PENDING:current@',
      'CONFIRMED:upcoming',
      'PREPARING:upcoming',
      'OUT_FOR_DELIVERY:upcoming',
      'DELIVERED:upcoming',
    ]);
  });

  it('marks passed steps done with their times', () => {
    const order: T = {
      status: 'PREPARING',
      timeline: [
        { status: 'PENDING', at: at(0) },
        { status: 'CONFIRMED', at: at(5) },
        { status: 'PREPARING', at: at(9) },
      ],
    };
    expect(states(order)).toEqual([
      'PENDING:done@',
      'CONFIRMED:done@',
      'PREPARING:current@',
      'OUT_FOR_DELIVERY:upcoming',
      'DELIVERED:upcoming',
    ]);
  });

  it('a delivered order is complete', () => {
    const order: T = {
      status: 'DELIVERED',
      timeline: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].map(
        (status, i) => ({ status: status as T['status'], at: at(i) }),
      ),
    };
    expect(buildTimeline(order).every((s) => s.state === 'done')).toBe(true);
  });

  it('a cancelled order stops where it got to, then shows Cancelled', () => {
    const order: T = {
      status: 'CANCELLED',
      timeline: [
        { status: 'PENDING', at: at(0) },
        { status: 'CONFIRMED', at: at(3) },
        { status: 'CANCELLED', at: at(7) },
      ],
    };
    expect(states(order)).toEqual(['PENDING:done@', 'CONFIRMED:done@', 'CANCELLED:cancelled@']);
  });
});

describe('newIdempotencyKey', () => {
  it('is a v4 UUID the server accepts', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('differs every time', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
  });
});
