import { act, render, renderHook, screen } from '@testing-library/react-native';

import type { Cart } from '@/api/cart';
import { cartSavings } from '@/features/cart/cartMath';
import { useCountUp } from '@/features/orders/Celebration';
import { JourneyCard, ROUTE_PROGRESS } from '@/features/orders/JourneyCard';

describe('useCountUp', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts a little below the number and lands exactly on it', async () => {
    const { result } = await renderHook(() => useCountUp(10042, 100));
    expect(result.current).toBe(10042 - 48);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(10042);
  });

  it('shows nothing until there is a number', async () => {
    const { result } = await renderHook(() => useCountUp(undefined));
    expect(result.current).toBeUndefined();
  });
});

describe('journey', () => {
  it('moves the scooter forward as the order progresses', () => {
    const order = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
    const values = order.map((s) => ROUTE_PROGRESS[s]);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(ROUTE_PROGRESS.DELIVERED).toBe(1);
  });

  it('shows the status and message, and the usual time while on the way', async () => {
    await render(
      <JourneyCard status="OUT_FOR_DELIVERY" placedLabel="Placed 2 Oct, 7:12 pm" etaMinutes={30} />,
    );
    expect(screen.getByText('Out for delivery')).toBeOnTheScreen();
    expect(screen.getByText('Your order is on its way.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Usually about 30 minutes')).toBeOnTheScreen();
  });

  it('drops the time once delivered', async () => {
    await render(<JourneyCard status="DELIVERED" placedLabel="Placed" etaMinutes={30} />);
    expect(screen.queryByLabelText('Usually about 30 minutes')).toBeNull();
  });
});

describe('cartSavings', () => {
  it('adds up MRP savings across lines', () => {
    const line = (price: number, mrp: number, quantity: number) => ({
      quantity,
      product: { price_paise: price, mrp_paise: mrp },
    });
    const cart = {
      lines: [line(4500, 5000, 2), line(2800, 2800, 1), line(9000, 9500, 1)],
    } as unknown as Pick<Cart, 'lines'>;
    expect(cartSavings(cart)).toBe(500 * 2 + 0 + 500);
  });
});
