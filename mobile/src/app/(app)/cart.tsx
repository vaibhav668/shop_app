import { router } from 'expo-router';
import { ArrowRight, ShoppingBasket, Sparkles, Trash2, Truck } from 'lucide-react-native';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cart, CartLine } from '@/api/cart';
import { Foil } from '@/components/decor';
import { ProductImage } from '@/components/product/ProductImage';
import { QueryError } from '@/components/QueryError';
import { Button, EmptyState, Money, QuantityStepper, Skeleton, Text } from '@/components/ui';
import { cartSavings, maxQuantityFor } from '@/features/cart/cartMath';
import { useCart, useCartActions } from '@/features/cart/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, shadow, spacing, tintFor } from '@/theme/tokens';

export default function CartScreen() {
  const cart = useCart();

  if (cart.isPending) return <CartSkeleton />;
  if (cart.isError) return <QueryError error={cart.error} onRetry={cart.refetch} />;
  if (cart.data.lines.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={ShoppingBasket}
          title="Your cart is waiting for something good."
          message="Fresh stock is a tap away."
          actionLabel="Start shopping"
          onAction={() => router.dismissTo('/')}
        />
      </View>
    );
  }
  return <CartContents cart={cart.data} />;
}

function CartContents({ cart }: { cart: Cart }) {
  const insets = useSafeAreaInsets();
  const belowMinimum = cart.min_order_remaining_paise > 0;
  const savings = cartSavings(cart);

  return (
    <View style={styles.root}>
      <FlatList
        data={cart.lines}
        keyExtractor={(line) => line.product.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {savings > 0 ? (
              <View style={styles.savings} accessibilityRole="text">
                <Foil borderRadius={radius.lg - 4} />
                <View>
                  <Sparkles size={18} strokeWidth={2.2} color={colors.forestDeep} />
                </View>
                <Text variant="button" color="forestDeep">
                  You&apos;re saving {formatPaise(savings)} on this order
                </Text>
              </View>
            ) : null}
            <FreeDeliveryProgress cart={cart} />
          </View>
        }
        renderItem={({ item }) => <CartLineRow line={item} />}
        ListFooterComponent={<BillDetails cart={cart} savings={savings} />}
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
        ) : null}
        <Button
          title={`Checkout · ${formatPaise(cart.total_paise)}`}
          icon={ArrowRight}
          fullWidth
          disabled={cart.has_issues || belowMinimum}
          onPress={() => router.push('/checkout')}
        />
      </View>
    </View>
  );
}

/** A bar that fills toward free delivery. */
function FreeDeliveryProgress({ cart }: { cart: Cart }) {
  const target = cart.rules.free_delivery_above_paise;
  const fraction = target > 0 ? Math.min(1, cart.subtotal_paise / target) : 1;
  const done = cart.free_delivery_remaining_paise === 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(fraction, { duration: 600 });
  }, [fraction, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  if (cart.rules.delivery_fee_paise === 0) return null;
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityLabel={
        done
          ? 'You get free delivery on this order'
          : `Add ${formatPaise(cart.free_delivery_remaining_paise)} more for free delivery`
      }
    >
      <View style={styles.progressText}>
        <Text variant="label" color={done ? 'forest' : 'text'}>
          {done
            ? 'Free delivery unlocked'
            : `Add ${formatPaise(cart.free_delivery_remaining_paise)} more for free delivery`}
        </Text>
        <Truck size={18} strokeWidth={2} color={colors.brand} />
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const { setQuantity } = useCartActions();
  const { product } = line;
  const blocked = line.issue === 'OUT_OF_STOCK' || line.issue === 'UNAVAILABLE';
  const remove = () => setQuantity(product, 0);

  return (
    <Animated.View
      layout={LinearTransition}
      exiting={FadeOut.duration(180)}
      style={styles.lineWrap}
    >
      {/* Swipe left to reveal Remove. Screen readers get the same as an action. */}
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={48}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.name}`}
            style={styles.swipeRemove}
          >
            <Trash2 size={18} strokeWidth={2.2} color={colors.onAction} />
            <Text variant="tag" color="onAction">
              Remove
            </Text>
          </Pressable>
        )}
      >
        <View
          style={styles.line}
          accessibilityActions={[{ name: 'remove', label: `Remove ${product.name}` }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'remove') remove();
          }}
        >
          <Pressable
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${product.name}`}
            style={[styles.thumb, { backgroundColor: tintFor(product.id) }]}
          >
            <ProductImage
              uri={product.image_url}
              name={product.name}
              faded={blocked}
              iconSize={24}
            />
          </Pressable>

          <View style={styles.lineInfo}>
            <Text variant="label" numberOfLines={2}>
              {product.name}
            </Text>
            <Text variant="caption" color="textSecondary">
              {product.unit_label}
            </Text>
            {line.issue === 'QUANTITY_REDUCED' ? (
              <Text variant="caption" color="goldDeep">
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
                onPress={remove}
                hitSlop={8}
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
            <Money paise={line.line_total_paise} variant="price" />
          </View>
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

function BillDetails({ cart, savings }: { cart: Cart; savings: number }) {
  return (
    <View style={styles.bill}>
      <Text variant="heading">Bill details</Text>
      <Row label={`Items (${cart.item_count})`} value={<Money paise={cart.subtotal_paise} />} />
      {savings > 0 ? (
        <Row
          label="You save"
          value={
            <Text variant="label" color="forestMid">
              −{formatPaise(savings)}
            </Text>
          }
        />
      ) : null}
      <Row
        label="Delivery fee"
        value={
          cart.delivery_fee_paise === 0 ? (
            <Text variant="label" color="forestMid">
              FREE
            </Text>
          ) : (
            <Money paise={cart.delivery_fee_paise} />
          )
        }
      />
      <View style={styles.billDivider} />
      <Row
        label={<Text variant="heading">To pay</Text>}
        value={<Money paise={cart.total_paise} variant="priceLg" />}
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
      <Skeleton height={48} radius={radius.lg - 4} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.line, styles.skeletonLine]}>
          <Skeleton width={56} height={56} radius={radius.md} />
          <View style={styles.skeletonText}>
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
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: gutter, paddingBottom: spacing.xl, gap: spacing.sm },
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  savings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg - 4,
    overflow: 'hidden',
  },
  progress: {
    ...shadow.sm,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg - 4,
    backgroundColor: colors.surface,
  },
  progressText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.brandTint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand },
  lineWrap: { borderRadius: radius.lg - 2, overflow: 'hidden' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 2,
  },
  swipeRemove: {
    width: 96,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumb: { width: 60, height: 60, padding: 6, borderRadius: radius.md },
  lineInfo: { flex: 1, gap: 2 },
  lineEnd: { alignItems: 'flex-end', gap: spacing.xs },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 },
  bill: {
    ...shadow.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billDivider: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    marginVertical: 2,
  },
  checkout: {
    ...shadow.md,
    gap: spacing.xs,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  skeletonLine: { marginTop: spacing.sm },
  skeletonText: { flex: 1, gap: 6 },
});
