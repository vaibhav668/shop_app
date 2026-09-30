import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// Kept on the device: the first-launch slides show once per install.
const KEY = 'bada-bazar.intro-seen';

export type IntroState = 'loading' | 'seen' | 'unseen';

let state: IntroState = 'loading';
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: IntroState) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= AsyncStorage.getItem(KEY)
    .then((value) => set(value ? 'seen' : 'unseen'))
    // Storage failing must never trap someone in the intro.
    .catch(() => set('seen'));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

export function useIntroState(): IntroState {
  return useSyncExternalStore(subscribe, () => state);
}

export async function markIntroSeen(): Promise<void> {
  set('seen');
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Worst case the slides show again next launch.
  }
}

/** Tests only. */
export function resetIntroStateForTests() {
  state = 'loading';
  loading = null;
}
