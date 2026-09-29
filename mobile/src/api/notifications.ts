import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type AppNotification = components['schemas']['NotificationOut'];
type NotificationPage = components['schemas']['Page_NotificationOut_'];

export const notificationsApi = {
  list: (offset: number) => api<NotificationPage>(`/notifications?limit=20&offset=${offset}`),
  unreadCount: () => api<{ count: number }>('/notifications/unread-count'),
  readAll: () => api<void>('/notifications/read-all', { method: 'POST' }),
  registerDevice: (token: string) =>
    api<void>('/me/devices', { method: 'POST', body: { token, platform: 'android' } }),
};
