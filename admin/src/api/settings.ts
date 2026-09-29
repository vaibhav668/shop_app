import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type ShopSettings = components['schemas']['AdminSettingsOut'];
export type ShopSettingsUpdate = components['schemas']['AdminSettingsUpdate'];

export const settingsKeys = { all: ['admin', 'settings'] as const };

export const settingsApi = {
  get: () => api<ShopSettings>('/admin/settings'),
  update: (body: ShopSettingsUpdate) =>
    api<ShopSettings>('/admin/settings', { method: 'PATCH', body }),
};
