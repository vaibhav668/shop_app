import { Plus } from 'lucide-react-native';
import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import type { ProductCard as ProductCardData } from '@/api/catalog';
import { ProductImage } from '@/components/product/ProductImage';
import { Badge, Money, PressableScale, QuantityStepper, Text } from '@/components/ui';
import { measure, useFlyToCart } from '@/features/cart/FlyToCart';
import { formatPaise } from '@/lib/money';
import { colors, motion, radius, shadow, spacing, tintFor } from '@/theme/tokens';

export type { ProductCardData };

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
 * the + button and stepper must not sit inside another button (invalid <button> nesting on
 * web, and screen readers would merge them). The visible content ignores touches, so a tap
 * anywhere except the cart controls falls through to the open layer.
 */
function ProductCardBase({ product, onPress, cart }: ProductCardProps) {
  const [pressed, setPressed] = useState(false);
  const imageRef = useRef<View>(null);
  const { fly } = useFlyToCart();
  const outOfStock = !product.is_available;
  const discount = product.discount_percent;
  const saving = product.mrp_paise - product.price_paise;

  const add = () => {
    void measure(imageRef).then((from) => {
      if (from) fly(from, product.image_url);
    });
    cart?.onAdd();
  };

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

      <View
        ref={imageRef}
        style={[styles.imageWell, { backgroundColor: tintFor(product.id) }, styles.passChildren]}
      >
        {/* Decorative for assistive tech: the open button above already announces all of this. */}
        <View style={[styles.imageBox, styles.passThrough]} aria-hidden>
          <ProductImage uri={product.image_url} faded={outOfStock} iconSize={40} />
        </View>
        {discount > 0 && !outOfStock ? (
          <View style={[styles.tag, styles.passThrough]} aria-hidden>
            <Badge label={`${discount}% OFF`} tone="foil" />
          </View>
        ) : null}

        <View style={[styles.control, styles.passChildren]}>
          {outOfStock ? (
            <View style={styles.soldOut}>
              <Text variant="tag" color="danger">
                Out of stock
              </Text>
            </View>
          ) : cart ? (
            cart.quantity > 0 ? (
              <QuantityStepper
                value={cart.quantity}
                max={product.max_per_order ?? undefined}
                onIncrement={cart.onIncrement}
                onDecrement={cart.onDecrement}
                itemName={product.name}
              />
            ) : (
              <Animated.View key="add" entering={ZoomIn.duration(motion.base)}>
                <PressableScale
                  onPress={add}
                  scaleTo={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.name} to cart`}
                  style={({ pressed: down }) => [styles.add, down && styles.addPressed]}
                >
                  <Plus size={18} strokeWidth={2.8} color={colors.goldBright} />
                </PressableScale>
              </Animated.View>
            )
          ) : null}
        </View>
      </View>

      <View style={[styles.body, styles.passThrough]} aria-hidden>
        <View style={styles.unit}>
          <Text variant="micro" color="textSecondary" numberOfLines={1}>
            {product.unit_label}
          </Text>
        </View>
        <Text variant="label" numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Money paise={product.price_paise} variant="price" />
          {discount > 0 ? (
            <Money paise={product.mrp_paise} variant="caption" color="textTertiary" strike />
          ) : null}
        </View>
        {product.stock_hint === 'LOW' && !outOfStock ? (
          <Text variant="micro" color="goldDeep">
            Only a few left
          </Text>
        ) : discount > 0 && saving > 0 ? (
          <Text variant="micro" color="brand">
            Save {formatPaise(saving)}
          </Text>
        ) : null}
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
  imageWell: { aspectRatio: 1 / 0.92, borderRadius: radius.lg - 4 },
  imageBox: { flex: 1, padding: spacing.md },
  tag: { position: 'absolute', top: 8, left: 8 },
  control: { position: 'absolute', right: 6, bottom: 6 },
  add: {
    ...shadow.md,
    shadowOpacity: 0.3,
    width: 36,
    height: 36,
    borderRadius: radius.md - 3,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { backgroundColor: colors.forestDeep },
  soldOut: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  body: { paddingTop: spacing.xs, paddingHorizontal: 4, paddingBottom: 4, gap: 3, flex: 1 },
  unit: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tintSand,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  name: { minHeight: 40 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 'auto' },
});
