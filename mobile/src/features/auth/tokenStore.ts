import * as SecureStore from 'expo-secure-store';

// The refresh token lives in the Android Keystore-backed secure store; the access token is
// memory-only and re-issued from it on launch.
const REFRESH_KEY = 'daily-basket.refresh-token';

export const tokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_KEY),
};
