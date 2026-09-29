import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type User = components['schemas']['UserOut'];
export type AuthResponse = components['schemas']['AuthResponse'];
type UpdateMe = components['schemas']['UpdateMeRequest'];

export const authApi = {
  signInWithGoogle: (idToken: string) =>
    api<AuthResponse>('/auth/google', {
      method: 'POST',
      body: { id_token: idToken, client: 'mobile' },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    api<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
    }),

  /** Admins only: a one-time code that signs them into the admin dashboard (and ends this
   *  shop session on the server). */
  adminHandoff: () =>
    api<{ code: string; expires_in: number }>('/auth/admin-handoff', { method: 'POST' }),

  /** Passing this phone's push token makes the server stop sending it pushes. */
  logout: (deviceToken?: string | null) =>
    api<void>('/auth/logout', {
      method: 'POST',
      body: deviceToken ? { device_token: deviceToken } : {},
    }),

  updateMe: (changes: UpdateMe) => api<User>('/me', { method: 'PATCH', body: changes }),

  deleteMe: () => api<void>('/me', { method: 'DELETE' }),
};
