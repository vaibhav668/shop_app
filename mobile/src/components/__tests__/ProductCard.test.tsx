import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';

const bread: ProductCardData = {
  id: 'bread',
  name: 'Whole Wheat Bread',
  unit_label: '400 g',
  price_paise: 4500,
  mrp_paise: 5000,
  discount_percent: 10,
  image_url: null,
  is_available: true,
  stock_hint: 'IN_STOCK',
  max_per_order: null,
};

async function setup(overrides: Partial<ProductCardData> = {}, quantity?: number) {
  const cart = { onAdd: jest.fn(), onIncrement: jest.fn(), onDecrement: jest.fn() };
  const onPress = jest.fn();
  await render(
    <ProductCard
      product={{ ...bread, ...overrides }}
      onPress={onPress}
      cart={quantity === undefined ? undefined : { quantity, ...cart }}
    />,
  );
  return { ...cart, onPress };
}

describe('<ProductCard />', () => {
  it('shows price, struck MRP and the discount tag', async () => {
    await setup();
    expect(await screen.findByText('₹45')).toBeOnTheScreen();
    expect(screen.getByText('₹50')).toBeOnTheScreen();
    expect(screen.getByText('10% OFF')).toBeOnTheScreen();
  });

  it('opens the product when tapped', async () => {
    const { onPress } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: /Whole Wheat Bread/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is browse-only without cart controls', async () => {
    await setup();
    expect(screen.queryByLabelText('Add Whole Wheat Bread to cart')).toBeNull();
  });

  it('shows ADD with cart controls, and calls onAdd', async () => {
    const { onAdd } = await setup({}, 0);
    await fireEvent.press(await screen.findByLabelText('Add Whole Wheat Bread to cart'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a stepper once the item is in the cart', async () => {
    const { onIncrement, onDecrement } = await setup({}, 2);
    expect(screen.queryByLabelText('Add Whole Wheat Bread to cart')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('Increase Whole Wheat Bread'));
    await fireEvent.press(screen.getByLabelText('Decrease Whole Wheat Bread'));
    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('cannot be added when out of stock', async () => {
    await setup({ is_available: false, stock_hint: 'OUT' }, 0);
    expect(await screen.findByText('Out of stock')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Add Whole Wheat Bread to cart')).toBeNull();
    expect(screen.queryByText('10% OFF')).toBeNull();
  });

  it('warns when stock is low', async () => {
    await setup({ stock_hint: 'LOW' });
    expect(await screen.findByText('Only a few left')).toBeOnTheScreen();
  });
});
