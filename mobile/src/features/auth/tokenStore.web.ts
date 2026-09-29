// Web preview only (`expo start --web`), used for local UI review. The Android app uses the
// secure-store implementation in tokenStore.ts.
const REFRESH_KEY = 'daily-basket.refresh-token';

export const tokenStore = {
  getRefreshToken: async () => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: async (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clear: async () => localStorage.removeItem(REFRESH_KEY),
};
