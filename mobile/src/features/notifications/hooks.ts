import { useQuery } from '@tanstack/react-query';

import { notificationsApi } from '@/api/notifications';
import { queryKeys } from '@/api/queryClient';

/** Drives the dot on the Account tab. Refreshed on app focus and whenever a push arrives. */
export function useUnreadCount(): number {
  const unread = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    staleTime: 30_000,
  });
  return unread.data?.count ?? 0;
}
