import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Wallet } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { Jaali } from '@/components/decor';
import { Button, Text } from '@/components/ui';
import { useShop } from '@/features/catalog/hooks';
import { askPermissionAndRegister } from '@/features/notifications/push';
import { Confetti, OrderSeal, useCountUp } from '@/features/orders/Celebration';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, shadow, spacing } from '@/theme/tokens';

const SEAL = 140;

export default function OrderPlacedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Filled from the place-order response, so this normally shows instantly.
  const order = useQuery({ queryKey: queryKeys.order(id), queryFn: () => ordersApi.get(id) });
  const shop = useShop();
  const number = useCountUp(order.data?.order_number);

  // The moment updates matter: ask for notification permission now (once), not at launch.
  // A pause lets the celebration land before the system dialog appears.
  useEffect(() => {
    const t = setTimeout(() => void askPermissionAndRegister(), 1600);
    return () => clearTimeout(t);
  }, []);

  const total = order.data ? formatPaise(order.data.total_paise) : null;

  return (
    <View style={styles.root}>
      <Jaali color={colors.brand} opacity={0.14} />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={styles.sealWrap}>
            <OrderSeal size={SEAL} />
          </View>
          <Confetti top={60 + SEAL / 2} />

          <Animated.View entering={FadeInUp.delay(300).duration(380)} style={styles.copy}>
            <Text variant="display" align="center" accessibilityRole="header">
              Order placed!
            </Text>
            {order.data ? (
              <Text
                variant="body"
                color="textSecondary"
                align="center"
                tabular
                accessibilityLabel={`Order ${order.data.order_number}, ${total}`}
              >
                Order #{number} · {total}
              </Text>
            ) : null}
          </Animated.View>

          {order.data ? (
            <Animated.View entering={FadeInUp.delay(480).duration(380)} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.icon, { backgroundColor: colors.tintMint }]}>
                  <Clock size={18} strokeWidth={2.2} color={colors.forest} />
                </View>
                <View style={styles.flex}>
                  <Text variant="label">
                    {shop.data
                      ? `Arriving in about ${shop.data.delivery_eta_minutes} min`
                      : 'On its way soon'}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    The shop will confirm it shortly
                  </Text>
                </View>
              </View>
              {order.data.payment_method === 'COD' ? (
                <View style={styles.cardRow}>
                  <View style={[styles.icon, { backgroundColor: colors.tintButter }]}>
                    <Wallet size={18} strokeWidth={2.2} color={colors.goldDeep} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="label">Keep {total} ready</Text>
                    <Text variant="caption" color="textSecondary">
                      Cash or UPI at your door
                    </Text>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <Animated.View entering={FadeInUp.delay(620).duration(380)} style={styles.actions}>
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
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: colors.brandTint,
    opacity: 0.8,
  },
  safe: { flex: 1, paddingHorizontal: gutter, paddingBottom: spacing.md },
  center: { flex: 1, alignItems: 'center', paddingTop: 60 },
  sealWrap: { width: SEAL, height: SEAL },
  copy: { gap: 4, marginTop: spacing.lg },
  card: {
    ...shadow.md,
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  actions: { gap: spacing.xs },
});
