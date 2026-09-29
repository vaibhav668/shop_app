import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type User = components['schemas']['UserOut'];
export type AuthResponse = components['schemas']['AuthResponse'];

export const authApi = {
  /** Exchanges the one-time code from the shop's sign-in page for an admin session. */
  redeemHandoff: (code: string) =>
    api<AuthResponse>('/auth/admin-handoff/redeem', {
      method: 'POST',
      body: { code },
      auth: false,
    }),

  // The refresh token travels as an httpOnly cookie; the body is empty on purpose.
  refresh: () => api<AuthResponse>('/auth/refresh', { method: 'POST', auth: false }),

  logout: () => api<void>('/auth/logout', { method: 'POST' }),

  updateMe: (changes: { name?: string; phone?: string }) =>
    api<User>('/me', { method: 'PATCH', body: changes }),
};
