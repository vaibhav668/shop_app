import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Category, Shop } from '@/api/catalog';
import { ProductCard } from '@/components/product/ProductCard';
import { BigWordTabs } from '@/features/catalog/BigWordTabs';
import { FlyToCartProvider, measure } from '@/features/cart/FlyToCart';
import { PromiseTiles } from '@/features/home/PromiseTiles';

const shop: Shop = {
  name: 'Bada Bazar',
  phone: null,
  is_accepting_orders: true,
  closed_message: 'Closed',
  delivery_fee_paise: 2000,
  free_delivery_above_paise: 29900,
  min_order_paise: 9900,
  delivery_eta_minutes: 25,
  cod_enabled: true,
  online_payment_enabled: false,
};

const categories: Category[] = [
  { id: '1', name: 'Dairy', slug: 'dairy', image_url: null },
  { id: '2', name: 'Bakery', slug: 'bakery', image_url: null },
];

describe('<PromiseTiles />', () => {
  it("shows the shop's own promises", async () => {
    await render(<PromiseTiles shop={shop} />);
    expect(screen.getByLabelText('Delivery in 25 min')).toBeOnTheScreen();
    expect(screen.getByLabelText('Free delivery Over ₹299')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cash or UPI Pay at door')).toBeOnTheScreen();
  });

  it('says delivery is always free when there is no fee', async () => {
    await render(<PromiseTiles shop={{ ...shop, delivery_fee_paise: 0 }} />);
    expect(screen.getByLabelText('Delivery Always free')).toBeOnTheScreen();
  });
});

describe('<BigWordTabs />', () => {
  it('marks the current category and switches on tap', async () => {
    const onSelect = jest.fn();
    await render(<BigWordTabs categories={categories} activeSlug="dairy" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Dairy' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bakery' }));
    expect(onSelect).toHaveBeenCalledWith('bakery');
  });
});

describe('fly to cart', () => {
  it('measures nothing when the view cannot report its position', async () => {
    await expect(measure({ current: null })).resolves.toBeNull();
    await expect(measure({ current: {} })).resolves.toBeNull();
  });

  it('reports a measured view', async () => {
    const node = { measureInWindow: (cb: (...n: number[]) => void) => cb(10, 20, 30, 40) };
    await expect(measure({ current: node })).resolves.toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it('still adds to the cart inside the provider', async () => {
    const onAdd = jest.fn();
    await render(
      <FlyToCartProvider>
        <ProductCard
          product={{
            id: 'p',
            name: 'Paneer',
            unit_label: '200 g',
            price_paise: 9000,
            mrp_paise: 9500,
            discount_percent: 5,
            image_url: null,
            is_available: true,
            stock_hint: 'IN_STOCK',
            max_per_order: null,
          }}
          cart={{ quantity: 0, onAdd, onIncrement: jest.fn(), onDecrement: jest.fn() }}
        />
      </FlyToCartProvider>,
    );
    expect(screen.getByText('Save ₹5', { includeHiddenElements: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Add Paneer to cart'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
