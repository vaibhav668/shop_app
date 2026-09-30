import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { ProductCard as ProductCardData } from '@/api/catalog';
import { ProductImage } from '@/components/product/ProductImage';
import { Badge, Money, QuantityStepper, Text } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { colors, motion, radius, shadow, spacing, tintFor } from '@/theme/tokens';

export type { ProductCardData };

/** Cart controls arrive in Phase 5; until a screen passes them, the card is browse-only. */
export type CartControls = {
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

export type ProductCardProps = {
  product: ProductCardData;
  onPress?: () => void;
  cart?: CartControls;
};

/**
 * The "open product" button is a full-card layer *behind* the content, not a wrapper around it:
 * the ADD button and stepper must not sit inside another button (invalid <button> nesting on
 * web, and screen readers would merge them). The visible content ignores touches, so a tap
 * anywhere except the cart controls falls through to the open layer.
 */
function ProductCardBase({ product, onPress, cart }: ProductCardProps) {
  const [pressed, setPressed] = useState(false);
  const outOfStock = !product.is_available;
  const discount = product.discount_percent;

  return (
    <View style={[styles.card, pressed && styles.pressed]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={`${product.name}, ${product.unit_label}, ${formatPaise(product.price_paise)}${
            outOfStock ? ', out of stock' : ''
          }`}
          style={styles.openLayer}
        />
      ) : null}

      {/* Decorative for assistive tech: the open button above already announces all of this. */}
      <View
        style={[styles.imageWell, { backgroundColor: tintFor(product.id) }, styles.passThrough]}
        aria-hidden
      >
        <ProductImage uri={product.image_url} faded={outOfStock} iconSize={40} />
        {discount > 0 && !outOfStock ? (
          <View style={styles.tag}>
            <Badge label={`${discount}% OFF`} tone="foil" />
          </View>
        ) : null}
      </View>

      <View style={[styles.body, styles.passChildren]}>
        <View style={[styles.text, styles.passThrough]} aria-hidden>
          <Text variant="label" numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
          <Text variant="caption" color="textSecondary">
            {product.unit_label}
          </Text>
          {product.stock_hint === 'LOW' ? (
            <Text variant="micro" color="offerText">
              Only a few left
            </Text>
          ) : null}
        </View>

        <View style={[styles.footer, styles.passChildren]}>
          <View style={styles.passThrough} aria-hidden>
            <Money paise={product.price_paise} variant="price" />
            {discount > 0 ? (
              <Money paise={product.mrp_paise} variant="caption" color="textTertiary" strike />
            ) : null}
          </View>

          {outOfStock ? (
            <Text variant="micro" color="danger">
              Out of stock
            </Text>
          ) : cart ? (
            cart.quantity > 0 ? (
              <Animated.View key="stepper" entering={FadeIn.duration(motion.base)}>
                <QuantityStepper
                  value={cart.quantity}
                  max={product.max_per_order ?? undefined}
                  onIncrement={cart.onIncrement}
                  onDecrement={cart.onDecrement}
                  itemName={product.name}
                />
              </Animated.View>
            ) : (
              <Animated.View key="add" entering={FadeIn.duration(motion.base)}>
                <Pressable
                  onPress={cart.onAdd}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.name} to cart`}
                  style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
                >
                  <Text variant="tag" color="goldBright" style={styles.addLabel}>
                    ADD
                  </Text>
                </Pressable>
              </Animated.View>
            )
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = StyleSheet.create({
  card: {
    ...shadow.sm,
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 6,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  openLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.lg,
  },
  // Content that lets taps fall through to the open layer...
  passThrough: { pointerEvents: 'none' },
  // ...and containers whose children (the cart controls) still take taps.
  passChildren: { pointerEvents: 'box-none' },
  text: { gap: 2 },
  imageWell: {
    aspectRatio: 1,
    borderRadius: radius.lg - 4,
    padding: spacing.sm,
  },
  tag: { position: 'absolute', top: 8, left: 8 },
  body: { paddingTop: spacing.xs, paddingHorizontal: 4, paddingBottom: 2, gap: 2, flex: 1 },
  name: { minHeight: 40 },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xs,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  add: {
    ...shadow.md,
    shadowOpacity: 0.25,
    height: 34,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md - 2,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { backgroundColor: colors.forestDeep },
  addLabel: { fontSize: 12, letterSpacing: 0.8 },
});
