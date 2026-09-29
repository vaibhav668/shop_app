import AsyncStorage from '@react-native-async-storage/async-storage';

// Kept on the device only; never sent to the server.
const KEY = 'bada-bazar.recent-searches';
export const MAX_RECENT = 8;

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Most recent first, case-insensitively de-duplicated, capped at MAX_RECENT. */
export function withRecent(list: string[], term: string): string[] {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (!clean) return list;
  const rest = list.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  return [clean, ...rest].slice(0, MAX_RECENT);
}

export async function saveRecentSearches(list: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Recent searches are a convenience; failing to save them must never break search.
  }
}
