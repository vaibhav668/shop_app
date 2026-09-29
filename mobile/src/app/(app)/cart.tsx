import { router } from 'expo-router';
import { ShoppingBasket, Trash2, Truck } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cart, CartLine } from '@/api/cart';
import { ProductImage } from '@/components/product/ProductImage';
import { QueryError } from '@/components/QueryError';
import { Button, EmptyState, Money, QuantityStepper, Skeleton, Text } from '@/components/ui';
import { maxQuantityFor } from '@/features/cart/cartMath';
import { useCart, useCartActions } from '@/features/cart/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, hitSlop, radius, spacing } from '@/theme/tokens';

export default function CartScreen() {
  const cart = useCart();

  if (cart.isPending) return <CartSkeleton />;
  if (cart.isError) return <QueryError error={cart.error} onRetry={cart.refetch} />;
  if (cart.data.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Your cart is waiting for something good."
        actionLabel="Start shopping"
        onAction={() => router.dismissTo('/')}
      />
    );
  }
  return <CartContents cart={cart.data} />;
}

function CartContents({ cart }: { cart: Cart }) {
  const insets = useSafeAreaInsets();
  const belowMinimum = cart.min_order_remaining_paise > 0;

  return (
    <View style={styles.root}>
      <FlatList
        data={cart.lines}
        keyExtractor={(line) => line.product.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          cart.free_delivery_remaining_paise > 0 ? (
            <View style={styles.nudge}>
              <Truck size={18} strokeWidth={1.75} color={colors.offerText} />
              <Text variant="label" color="offerText" style={styles.flex}>
                Add {formatPaise(cart.free_delivery_remaining_paise)} more for free delivery
              </Text>
            </View>
          ) : cart.subtotal_paise > 0 ? (
            <View style={[styles.nudge, styles.nudgeDone]}>
              <Truck size={18} strokeWidth={1.75} color={colors.action} />
              <Text variant="label" color="action">
                You get free delivery on this order
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <CartLineRow line={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={<BillDetails cart={cart} />}
      />

      <View style={[styles.checkout, { paddingBottom: spacing.sm + insets.bottom }]}>
        {cart.has_issues ? (
          <Text variant="caption" color="danger">
            Some items changed. Update or remove them before checkout.
          </Text>
        ) : belowMinimum ? (
          <Text variant="caption" color="textSecondary">
            Minimum order is {formatPaise(cart.rules.min_order_paise)}. Add{' '}
            {formatPaise(cart.min_order_remaining_paise)} more.
          </Text>
        ) : (
          <Text variant="caption" color="textSecondary">
            Checkout opens in the next update of the app.
          </Text>
        )}
        <Button title={`Checkout · ${formatPaise(cart.total_paise)}`} fullWidth disabled />
      </View>
    </View>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const { setQuantity } = useCartActions();
  const { product } = line;
  const blocked = line.issue === 'OUT_OF_STOCK' || line.issue === 'UNAVAILABLE';

  return (
    <View style={styles.line}>
      <Pressable
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${product.name}`}
        style={styles.thumb}
      >
        <ProductImage uri={product.image_url} faded={blocked} iconSize={24} />
      </Pressable>

      <View style={styles.lineInfo}>
        <Text variant="label" numberOfLines={2}>
          {product.name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {product.unit_label}
        </Text>
        {line.issue === 'QUANTITY_REDUCED' ? (
          <Text variant="caption" color="offerText">
            Only {line.available_quantity} available now
          </Text>
        ) : line.issue === 'OUT_OF_STOCK' ? (
          <Text variant="caption" color="danger">
            Out of stock
          </Text>
        ) : line.issue === 'UNAVAILABLE' ? (
          <Text variant="caption" color="danger">
            No longer sold
          </Text>
        ) : null}
      </View>

      <View style={styles.lineEnd}>
        {blocked ? (
          <Pressable
            onPress={() => setQuantity(product, 0)}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.name}`}
            style={styles.remove}
          >
            <Trash2 size={16} color={colors.danger} />
            <Text variant="label" color="danger">
              Remove
            </Text>
          </Pressable>
        ) : (
          <QuantityStepper
            value={line.quantity}
            max={maxQuantityFor(product)}
            onIncrement={() => setQuantity(product, line.quantity + 1)}
            onDecrement={() => setQuantity(product, line.quantity - 1)}
            itemName={product.name}
          />
        )}
        <Money paise={line.line_total_paise} variant="bodyStrong" />
      </View>
    </View>
  );
}

function BillDetails({ cart }: { cart: Cart }) {
  return (
    <View style={styles.bill}>
      <Text variant="heading">Bill details</Text>
      <Row label={`Items (${cart.item_count})`} value={<Money paise={cart.subtotal_paise} />} />
      <Row
        label="Delivery fee"
        value={
          cart.delivery_fee_paise === 0 ? (
            <Text variant="label" color="action">
              FREE
            </Text>
          ) : (
            <Money paise={cart.delivery_fee_paise} />
          )
        }
      />
      <View style={styles.billDivider} />
      <Row
        label={<Text variant="bodyStrong">To pay</Text>}
        value={<Money paise={cart.total_paise} variant="bodyStrong" />}
      />
    </View>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {typeof label === 'string' ? (
        <Text variant="body" color="textSecondary">
          {label}
        </Text>
      ) : (
        label
      )}
      {value}
    </View>
  );
}

function CartSkeleton() {
  return (
    <View style={[styles.root, styles.list]} accessibilityLabel="Loading cart">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.line, { gap: spacing.sm }]}>
          <Skeleton width={56} height={56} radius={radius.sm} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={12} width="30%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: gutter, paddingBottom: spacing.xl },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.offerTint,
  },
  nudgeDone: { backgroundColor: colors.brandTint },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  separator: { height: 1, backgroundColor: colors.border },
  thumb: {
    width: 56,
    height: 56,
    padding: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  lineInfo: { flex: 1, gap: 2 },
  lineEnd: { alignItems: 'flex-end', gap: spacing.xs },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 },
  bill: {
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billDivider: { height: 1, backgroundColor: colors.border },
  checkout: {
    gap: spacing.xs,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
