import { useQueryClient } from '@tanstack/react-query';
import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { queryKeys } from '@/api/queryClient';

import { Notifications } from './native';
import { registerIfPermitted, routeFromData, sendToken } from './push';

// While the app is open, show order updates as a banner too.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Mounted once while signed in: keeps this phone registered and reacts to pushes. */
export function PushManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Notifications) return;
    void registerIfPermitted();

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allOrders });
    };
    const open = (response: NotificationResponse | null) => {
      const route = routeFromData(response?.notification.request.content.data);
      if (!route) return;
      const orderId = route.split('/').pop()!;
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      router.push({ pathname: '/orders/[id]', params: { id: orderId } });
    };

    const received = Notifications.addNotificationReceivedListener(refresh);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    // FCM can rotate the token; keep the server's copy current.
    const rotated = Notifications.addPushTokenListener(({ data }) => {
      void sendToken(String(data)).catch(() => {});
    });
    // Opened from a notification while the app was closed.
    void Notifications.getLastNotificationResponseAsync().then(open);

    return () => {
      received.remove();
      tapped.remove();
      rotated.remove();
    };
  }, [queryClient]);

  return null;
}
