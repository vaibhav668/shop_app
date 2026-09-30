import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Check, MapPin, PackageX, Phone, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { type OrderDetail, ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { ProductImage } from '@/components/product/ProductImage';
import { QueryError } from '@/components/QueryError';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Money, Skeleton, Text } from '@/components/ui';
import { useShop } from '@/features/catalog/hooks';
import { JourneyCard } from '@/features/orders/JourneyCard';
import {
  buildTimeline,
  FINISHED,
  formatOrderTime,
  type TimelineStep,
} from '@/features/orders/orderStatus';
import { confirmAction } from '@/lib/dialogs';
import { colors, gutter, radius, shadow, spacing, tintFor } from '@/theme/tokens';

const POLL_MS = 20_000;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const order = useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => ordersApi.get(id),
    staleTime: 0,
    // Check for status changes while the customer is looking, until the order is finished.
    refetchInterval: (query) =>
      focused && query.state.data && !FINISHED.has(query.state.data.status) ? POLL_MS : false,
  });

  if (order.isPending) return <OrderSkeleton />;
  if (order.isError) {
    if (order.error instanceof ApiError && order.error.status === 404) {
      return (
        <View style={styles.center}>
          <EmptyState
            icon={PackageX}
            title="Order not found"
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </View>
      );
    }
    return <QueryError error={order.error} onRetry={order.refetch} />;
  }
  return <OrderView order={order.data} />;
}

function OrderView({ order }: { order: OrderDetail }) {
  const insets = useSafeAreaInsets();
  const cancel = useCancelOrder(order);
  const shop = useShop();
  const a = order.delivery_address;
  const shopPhone = shop.data?.phone;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: `Order #${order.order_number}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInUp.duration(320)}>
          <JourneyCard
            status={order.status}
            placedLabel={`Placed ${formatOrderTime(order.placed_at)}`}
            etaMinutes={shop.data?.delivery_eta_minutes}
          />
        </Animated.View>

        {order.cancel_reason ? (
          <View style={[styles.card, styles.cancelNote]}>
            <Text variant="label" color="danger">
              Reason: {order.cancel_reason}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text variant="heading">Progress</Text>
          <Timeline steps={buildTimeline(order)} />
        </View>

        <View style={styles.card}>
          <Text variant="heading">
            {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
          </Text>
          {order.items.map((item) => (
            <View key={item.product_id} style={styles.item}>
              <View style={[styles.thumb, { backgroundColor: tintFor(item.product_id) }]}>
                <ProductImage uri={item.image_url} name={item.name} iconSize={18} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text variant="caption" color="textSecondary" tabular>
                  {item.unit_label} · {item.quantity} ×{' '}
                  <Money paise={item.unit_price_paise} variant="caption" color="textSecondary" />
                </Text>
              </View>
              <Money paise={item.line_total_paise} variant="price" />
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Items total" paise={order.subtotal_paise} />
          <Row label="Delivery fee" paise={order.delivery_fee_paise} free />
          <View style={styles.row}>
            <Text variant="heading">
              {order.payment_status === 'PAID' ? 'Paid' : 'To pay on delivery'}
            </Text>
            <Money paise={order.total_paise} variant="priceLg" />
          </View>
          <Text variant="caption" color="textSecondary">
            {order.payment_method === 'COD' ? 'Cash or UPI at your door' : 'Paid online'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.addressHead}>
            <View style={styles.addressIcon}>
              <MapPin size={16} strokeWidth={2.2} color={colors.forest} />
            </View>
            <Text variant="heading">Delivering to</Text>
          </View>
          <Text variant="bodyStrong">{a.name}</Text>
          <Text variant="body" color="textSecondary">
            {[a.line1, a.line2, a.landmark, `${a.city} ${a.pincode}`].filter(Boolean).join(', ')}
          </Text>
          <Text variant="caption" color="textSecondary" tabular>
            +91 {a.phone}
          </Text>
          {order.customer_note ? (
            <Text variant="caption" color="textSecondary">
              Note: {order.customer_note}
            </Text>
          ) : null}
        </View>

        {shopPhone && !FINISHED.has(order.status) ? (
          <Button
            title="Call the shop"
            icon={Phone}
            variant="secondary"
            fullWidth
            onPress={() => void Linking.openURL(`tel:${shopPhone.replace(/\s/g, '')}`)}
          />
        ) : null}
      </ScrollView>

      {order.can_cancel ? (
        <View style={[styles.footer, { paddingBottom: spacing.sm + insets.bottom }]}>
          <Button
            title="Cancel order"
            variant="danger"
            fullWidth
            loading={cancel.isPending}
            onPress={cancel.confirm}
          />
        </View>
      ) : null}
    </View>
  );
}

function useCancelOrder(order: OrderDetail) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => ordersApi.cancel(order.id, null),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.order(order.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.allOrders });
      toast.show('Order cancelled');
    },
    onError: (e) => {
      // Most likely the shop accepted it a moment ago: show the fresh state.
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      toast.show(e instanceof ApiError ? e.message : "Couldn't cancel. Try again?");
    },
  });
  const confirm = async () => {
    const confirmed = await confirmAction({
      title: `Cancel order #${order.order_number}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      destructive: true,
    });
    if (confirmed) mutation.mutate();
  };
  return { confirm, isPending: mutation.isPending };
}

/** The current step's dot breathes gold; done steps are filled green with a check. */
function PulsingDot() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
  }, [pulse, reduceMotion]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));
  return (
    <View style={[styles.dot, styles.dotCurrent]}>
      <Animated.View style={[styles.ring, ring]} />
    </View>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View style={styles.timeline} accessibilityRole="list">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const nextReached = !last && steps[i + 1].state !== 'upcoming';
        return (
          <View key={step.status} style={styles.step} accessibilityLabel={step.label}>
            <View style={styles.rail}>
              {step.state === 'current' ? (
                <PulsingDot />
              ) : step.state === 'done' ? (
                <View style={[styles.dot, styles.dotDone]}>
                  <Check size={12} strokeWidth={3} color={colors.onAction} />
                </View>
              ) : step.state === 'cancelled' ? (
                <View style={[styles.dot, styles.dotCancelled]}>
                  <X size={12} strokeWidth={3} color={colors.onAction} />
                </View>
              ) : (
                <View style={[styles.dot, styles.dotUpcoming]} />
              )}
              {!last ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: nextReached ? colors.brand : colors.border },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepText}>
              <Text
                variant={step.state === 'current' ? 'heading' : 'label'}
                color={
                  step.state === 'cancelled'
                    ? 'danger'
                    : step.state === 'upcoming'
                      ? 'textTertiary'
                      : 'text'
                }
              >
                {step.label}
              </Text>
              {step.at ? (
                <Text variant="caption" color="textSecondary">
                  {formatOrderTime(step.at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Row({ label, paise, free = false }: { label: string; paise: number; free?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      {free && paise === 0 ? (
        <Text variant="label" color="forestMid">
          FREE
        </Text>
      ) : (
        <Money paise={paise} />
      )}
    </View>
  );
}

function OrderSkeleton() {
  return (
    <View style={[styles.root, styles.content]} accessibilityLabel="Loading order">
      <Skeleton height={220} radius={radius.xl} />
      <Skeleton height={240} radius={radius.lg} />
      <Skeleton height={180} radius={radius.lg} />
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  flex: { flex: 1, gap: 2 },
  content: { padding: gutter, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    ...shadow.sm,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  cancelNote: { backgroundColor: colors.dangerTint, shadowOpacity: 0, elevation: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 48, height: 48, padding: 5, borderRadius: radius.md - 2 },
  divider: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    marginVertical: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addressIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.tintMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: { marginTop: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm, minHeight: 52 },
  rail: { alignItems: 'center', width: DOT },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.brand },
  dotCurrent: { backgroundColor: colors.gold },
  dotCancelled: { backgroundColor: colors.danger },
  dotUpcoming: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  ring: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.gold,
  },
  line: { flex: 1, width: 2, marginVertical: 3 },
  stepText: { flex: 1, paddingBottom: spacing.sm, paddingTop: 2 },
  footer: {
    ...shadow.md,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
});
