import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, QuantityStepper } from '@/components/ui';

describe('<Button />', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Place order" onPress={onPress} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled or loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button title="Place order" onPress={onPress} disabled />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Place order' }));
    await rerender(<Button title="Place order" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Place order' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('<QuantityStepper />', () => {
  it('disables increase at the maximum', async () => {
    const onIncrement = jest.fn();
    await render(
      <QuantityStepper value={5} max={5} onIncrement={onIncrement} onDecrement={jest.fn()} />,
    );
    await fireEvent.press(await screen.findByLabelText('Increase quantity'));
    expect(onIncrement).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
  });
});
