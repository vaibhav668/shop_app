import type { AdminBanner } from '@/api/catalog';
import type { BadgeTone } from '@/components/Badge';

export type BannerStatus = { label: string; tone: BadgeTone };

export function bannerStatus(b: AdminBanner, now = new Date()): BannerStatus {
  if (!b.is_active) return { label: 'Hidden', tone: 'neutral' };
  if (b.starts_at && new Date(b.starts_at) > now) return { label: 'Scheduled', tone: 'warning' };
  if (b.ends_at && new Date(b.ends_at) <= now) return { label: 'Ended', tone: 'neutral' };
  return { label: 'Live', tone: 'success' };
}
