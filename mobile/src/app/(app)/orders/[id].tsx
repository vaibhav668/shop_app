import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PackageX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { type OrderDetail, ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { ProductImage } from '@/components/product/ProductImage';
import { QueryError } from '@/components/QueryError';
import { useToast } from '@/components/Toast';
import { Badge, Button, EmptyState, Money, Skeleton, Text } from '@/components/ui';
import {
  buildTimeline,
  FINISHED,
  formatOrderTime,
  STATUS_LABEL,
  STATUS_MESSAGE,
  STATUS_TONE,
  type TimelineStep,
} from '@/features/orders/orderStatus';
import { confirmAction } from '@/lib/dialogs';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

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
        <EmptyState
          icon={PackageX}
          title="Order not found"
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      );
    }
    return <QueryError error={order.error} onRetry={order.refetch} />;
  }
  return <OrderView order={order.data} />;
}

function OrderView({ order }: { order: OrderDetail }) {
  const insets = useSafeAreaInsets();
  const cancel = useCancelOrder(order);
  const a = order.delivery_address;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: `Order #${order.order_number}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Badge label={STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} />
            <Text variant="caption" color="textSecondary">
              Placed {formatOrderTime(order.placed_at)}
            </Text>
          </View>
          <Text variant="bodyStrong">{STATUS_MESSAGE[order.status]}</Text>
          {order.cancel_reason ? (
            <Text variant="body" color="textSecondary">
              Reason: {order.cancel_reason}
            </Text>
          ) : null}
          <Timeline steps={buildTimeline(order)} />
        </View>

        <View style={styles.card}>
          <Text variant="label" color="textSecondary">
            {order.item_count} {order.item_count === 1 ? 'ITEM' : 'ITEMS'}
          </Text>
          {order.items.map((item) => (
            <View key={item.product_id} style={styles.item}>
              <View style={styles.thumb}>
                <ProductImage uri={item.image_url} iconSize={18} />
              </View>
              <View style={styles.flex}>
                <Text variant="body" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text variant="caption" color="textSecondary" tabular>
                  {item.unit_label} · {item.quantity} ×{' '}
                  <Money paise={item.unit_price_paise} variant="caption" color="textSecondary" />
                </Text>
              </View>
              <Money paise={item.line_total_paise} />
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Items total" paise={order.subtotal_paise} />
          <Row label="Delivery fee" paise={order.delivery_fee_paise} free />
          <View style={styles.row}>
            <Text variant="bodyStrong">
              {order.payment_status === 'PAID' ? 'Paid' : 'To pay on delivery'}
            </Text>
            <Money paise={order.total_paise} variant="bodyStrong" />
          </View>
          <Text variant="caption" color="textSecondary">
            {order.payment_method === 'COD' ? 'Cash on delivery' : 'Paid online'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text variant="label" color="textSecondary">
            DELIVERY ADDRESS
          </Text>
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

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View style={styles.timeline} accessibilityRole="list">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const reached = step.state !== 'upcoming';
        const dotColor =
          step.state === 'cancelled' ? colors.danger : reached ? colors.brand : colors.borderStrong;
        return (
          <View key={step.status} style={styles.step} accessibilityLabel={step.label}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: reached ? dotColor : colors.surface, borderColor: dotColor },
                ]}
              />
              {!last ? (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor:
                        steps[i + 1].state !== 'upcoming' ? colors.brand : colors.border,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepText}>
              <Text
                variant={step.state === 'current' ? 'bodyStrong' : 'body'}
                color={step.state === 'cancelled' ? 'danger' : reached ? 'text' : 'textTertiary'}
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
        <Text variant="label" color="action">
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
      <Skeleton height={240} radius={radius.lg} />
      <Skeleton height={180} radius={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, gap: 2 },
  content: { padding: gutter, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    width: 44,
    height: 44,
    padding: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeline: { marginTop: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  rail: { alignItems: 'center', width: 14 },
  dot: { width: 14, height: 14, borderRadius: radius.full, borderWidth: 2, marginTop: 3 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  stepText: { flex: 1, paddingBottom: spacing.sm },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
