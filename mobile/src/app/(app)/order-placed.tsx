import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { Button, Screen, Text } from '@/components/ui';
import { askPermissionAndRegister } from '@/features/notifications/push';
import { formatPaise } from '@/lib/money';
import { colors, radius, spacing } from '@/theme/tokens';

export default function OrderPlacedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Filled from the place-order response, so this normally shows instantly.
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id) });

  // The moment updates matter: ask for notification permission now (once), not at launch.
  // A short pause lets the success tick land before the system dialog appears.
  useEffect(() => {
    const t = setTimeout(() => void askPermissionAndRegister(), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.duration(250)} style={styles.badge}>
          <Check size={40} color={colors.onAction} strokeWidth={2.5} />
        </Animated.View>
        <Text variant="title" align="center" accessibilityRole="header">
          Order placed!
        </Text>
        {order.data ? (
          <>
            <Text variant="body" color="textSecondary" align="center" tabular>
              Order #{order.data.order_number} · {formatPaise(order.data.total_paise)}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {order.data.payment_method === 'COD'
                ? 'Keep cash or UPI ready when it arrives. The shop will confirm it shortly.'
                : 'The shop will confirm it shortly.'}
            </Text>
          </>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button
          title="Track order"
          fullWidth
          onPress={() => router.replace({ pathname: '/orders/[id]', params: { id } })}
        />
        <Button
          title="Continue shopping"
          variant="ghost"
          fullWidth
          onPress={() => router.dismissTo('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badge: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actions: { gap: spacing.xs, paddingBottom: spacing.lg },
});
