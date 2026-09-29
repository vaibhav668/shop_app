import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';

const bread: ProductCardData = {
  id: 'bread',
  name: 'Whole Wheat Bread',
  unitLabel: '400 g',
  pricePaise: 4500,
  mrpPaise: 5000,
  imageUrl: null,
  stockHint: 'IN_STOCK',
};

async function setup(overrides: Partial<ProductCardData> = {}, quantity = 0) {
  const handlers = { onAdd: jest.fn(), onIncrement: jest.fn(), onDecrement: jest.fn() };
  const view = await render(
    <ProductCard product={{ ...bread, ...overrides }} quantity={quantity} {...handlers} />,
  );
  return { ...handlers, view };
}

describe('<ProductCard />', () => {
  it('shows price, struck MRP and the discount tag', async () => {
    await setup();
    expect(await screen.findByText('₹45')).toBeOnTheScreen();
    expect(screen.getByText('₹50')).toBeOnTheScreen();
    expect(screen.getByText('10% OFF')).toBeOnTheScreen();
  });

  it('shows ADD when not in the cart, and calls onAdd', async () => {
    const { onAdd } = await setup();
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
    await setup({ stockHint: 'OUT' });
    expect(await screen.findByText('Out of stock')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Add Whole Wheat Bread to cart')).toBeNull();
    expect(screen.queryByText('10% OFF')).toBeNull();
  });

  it('warns when stock is low', async () => {
    await setup({ stockHint: 'LOW' });
    expect(await screen.findByText('Only a few left')).toBeOnTheScreen();
  });
});
