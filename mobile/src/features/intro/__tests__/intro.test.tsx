import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import IntroScreen from '@/app/intro';
import { markIntroSeen, resetIntroStateForTests, useIntroState } from '@/features/intro/introSeen';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetIntroStateForTests();
});

describe('intro state', () => {
  it('is unseen on a fresh install, then remembered', async () => {
    const { result } = await renderHook(() => useIntroState());
    await waitFor(() => expect(result.current).toBe('unseen'));

    await act(() => markIntroSeen());
    expect(result.current).toBe('seen');
    expect(await AsyncStorage.getItem('bada-bazar.intro-seen')).toBe('1');
  });

  it('is seen when the device already has the flag', async () => {
    await AsyncStorage.setItem('bada-bazar.intro-seen', '1');
    const { result } = await renderHook(() => useIntroState());
    await waitFor(() => expect(result.current).toBe('seen'));
  });
});

describe('<IntroScreen />', () => {
  it('can be skipped', async () => {
    const { result } = await renderHook(() => useIntroState());
    await waitFor(() => expect(result.current).toBe('unseen'));
    await render(<IntroScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(result.current).toBe('seen');
  });

  it('walks to the last slide, then gets started', async () => {
    const { result } = await renderHook(() => useIntroState());
    await waitFor(() => expect(result.current).toBe('unseen'));
    await render(<IntroScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(result.current).toBe('seen');
  });
});
