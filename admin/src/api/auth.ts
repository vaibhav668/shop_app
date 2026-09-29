import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type User = components['schemas']['UserOut'];
export type AuthResponse = components['schemas']['AuthResponse'];

export const authApi = {
  signInWithGoogle: (idToken: string) =>
    api<AuthResponse>('/auth/google', {
      method: 'POST',
      body: { id_token: idToken, client: 'admin' },
      auth: false,
    }),

  devLogin: (email: string) =>
    api<AuthResponse>('/auth/dev-login', {
      method: 'POST',
      body: { email, client: 'admin' },
      auth: false,
    }),

  // The refresh token travels as an httpOnly cookie; the body is empty on purpose.
  refresh: () => api<AuthResponse>('/auth/refresh', { method: 'POST', auth: false }),

  logout: () => api<void>('/auth/logout', { method: 'POST' }),
};
