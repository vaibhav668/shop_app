import { routeFromData } from '@/features/notifications/push';

const ORDER_ID = '0b9f7f3e-4c1d-4a55-9a7e-2f1c3d4e5f60';

describe('routeFromData', () => {
  it('follows order links', () => {
    expect(routeFromData({ route: `/orders/${ORDER_ID}` })).toBe(`/orders/${ORDER_ID}`);
  });

  it.each([
    [{ route: '/checkout' }],
    [{ route: 'https://example.com/phish' }],
    [{ route: `/orders/${ORDER_ID}/../../cart` }],
    [{ route: 42 }],
    [{}],
    [null],
    [undefined],
  ])('ignores anything else: %p', (data) => {
    expect(routeFromData(data)).toBeNull();
  });
});
