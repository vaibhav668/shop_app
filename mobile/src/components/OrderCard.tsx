import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { OrderSummary } from '@/api/orders';
import { ProductImage } from '@/components/product/ProductImage';
import { Badge, Money, PressableScale, Text } from '@/components/ui';
import {
  FINISHED,
  formatOrderTime,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/features/orders/orderStatus';
import { colors, radius, shadow, spacing, tints } from '@/theme/tokens';

const STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

export function OrderCard({ order }: { order: OrderSummary }) {
  const active = !FINISHED.has(order.status);
  const reached = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${STATUS_LABEL[order.status]}`}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="heading" tabular>
            Order #{order.order_number}
          </Text>
          <Text variant="caption" color="textSecondary">
            {formatOrderTime(order.placed_at)}
          </Text>
        </View>
        <Badge label={STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} />
      </View>

      {active && reached >= 0 ? (
        <View style={styles.progress} accessibilityElementsHidden>
          {STEPS.slice(0, 4).map((s, i) => (
            <View key={s} style={[styles.segment, i <= reached && styles.segmentOn]} />
          ))}
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.thumbs}>
          {order.first_item_images.slice(0, 3).map((uri, i) => (
            <View
              key={uri}
              style={[
                styles.thumb,
                { backgroundColor: tints[i % tints.length], zIndex: 3 - i },
                i > 0 && styles.overlap,
              ]}
            >
              <ProductImage uri={uri} iconSize={16} />
            </View>
          ))}
          <Text variant="caption" color="textSecondary" style={styles.count}>
            {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Money paise={order.total_paise} variant="price" />
        <View style={styles.chevron}>
          <ChevronRight size={16} strokeWidth={2.4} color={colors.goldBright} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow.sm,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  flex: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.brandTint },
  segmentOn: { backgroundColor: colors.brand },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thumbs: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 36,
    height: 36,
    padding: 3,
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  overlap: { marginLeft: -10 },
  count: { marginLeft: spacing.xs },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
