import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Text as RNText } from 'react-native';

import { BrandLockup } from '@/components/BrandMark';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Badge, Chip, EmptyState } from '@/components/ui';
import { tintFor, tints } from '@/theme/tokens';

function tabProps(index: number, emit = jest.fn(() => ({ defaultPrevented: false }))) {
  const routes = ['index', 'categories', 'orders'].map((name) => ({ key: `${name}-key`, name }));
  const titles: Record<string, string> = {
    index: 'Home',
    categories: 'Categories',
    orders: 'Orders',
  };
  const descriptors = Object.fromEntries(
    routes.map((r) => [
      r.key,
      { options: { title: titles[r.name], tabBarIcon: () => <RNText>icon</RNText> } },
    ]),
  );
  const navigate = jest.fn();
  const props = {
    state: { index, routes },
    descriptors,
    navigation: { emit, navigate },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
  return { props, navigate, emit };
}

describe('<FloatingTabBar />', () => {
  it('labels only the active tab and marks it selected', async () => {
    await render(<FloatingTabBar {...tabProps(1).props} />);
    expect(screen.getByText('Categories')).toBeOnTheScreen();
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Categories' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Home' })).not.toBeSelected();
  });

  it('navigates to another tab', async () => {
    const { props, navigate } = tabProps(0);
    await render(<FloatingTabBar {...props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Orders' }));
    expect(navigate).toHaveBeenCalledWith('orders', undefined);
  });

  it('does not navigate when the tab press is handled elsewhere', async () => {
    const { props, navigate } = tabProps(
      0,
      jest.fn(() => ({ defaultPrevented: true })),
    );
    await render(<FloatingTabBar {...props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Orders' }));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('design kit', () => {
  it('gives the same id the same tint every time', () => {
    expect(tintFor('milk-500')).toBe(tintFor('milk-500'));
    expect(tints).toContain(tintFor('any-product'));
  });

  it('renders a foil badge label', async () => {
    await render(<Badge label="12% OFF" tone="foil" />);
    expect(screen.getByText('12% OFF')).toBeOnTheScreen();
  });

  it('reports a chip as selected', async () => {
    await render(<Chip label="Offers" selected onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Offers' })).toBeSelected();
  });

  it('announces the brand once, not the Devanagari name', async () => {
    await render(<BrandLockup />);
    expect(screen.getByRole('header', { name: 'Bada Bazar' })).toBeOnTheScreen();
  });

  it('runs the empty-state action', async () => {
    const onAction = jest.fn();
    const { Search } = jest.requireActual('lucide-react-native');
    await render(
      <EmptyState
        icon={Search}
        title="No results"
        actionLabel="Clear search"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onAction).toHaveBeenCalled();
  });
});
