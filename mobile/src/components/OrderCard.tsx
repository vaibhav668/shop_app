import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OrderSummary } from '@/api/orders';
import { ProductImage } from '@/components/product/ProductImage';
import { Badge, Money, Text } from '@/components/ui';
import { formatOrderTime, STATUS_LABEL, STATUS_TONE } from '@/features/orders/orderStatus';
import { colors, radius, spacing } from '@/theme/tokens';

export function OrderCard({ order }: { order: OrderSummary }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${STATUS_LABEL[order.status]}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="bodyStrong" tabular>
            Order #{order.order_number}
          </Text>
          <Text variant="caption" color="textSecondary">
            {formatOrderTime(order.placed_at)}
          </Text>
        </View>
        <Badge label={STATUS_LABEL[order.status]} tone={STATUS_TONE[order.status]} />
      </View>

      <View style={styles.bottom}>
        <View style={styles.thumbs}>
          {order.first_item_images.slice(0, 3).map((uri) => (
            <View key={uri} style={styles.thumb}>
              <ProductImage uri={uri} iconSize={16} />
            </View>
          ))}
          <Text variant="caption" color="textSecondary">
            {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Money paise={order.total_paise} variant="bodyStrong" />
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  flex: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thumbs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  thumb: {
    width: 32,
    height: 32,
    padding: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
});
