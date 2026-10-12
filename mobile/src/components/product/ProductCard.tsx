import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import type { ProductCard as ProductCardData } from '@/api/catalog';
import { Foil } from '@/components/decor';
import { ProductImage } from '@/components/product/ProductImage';
import { Money, PressableScale, QuantityStepper, Text } from '@/components/ui';
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
 * The compact quick-commerce card: a square tinted tile with the picture, a foil discount tab
 * hanging from its top edge, and an ADD button half over its bottom edge that becomes a
 * stepper. Unit, name and price sit tight underneath.
 *
 * The "open product" button is a full-card layer *behind* the content, not a wrapper around it:
 * ADD and the stepper must not sit inside another button (invalid <button> nesting on web, and
 * screen readers would merge them). Visible content ignores touches, so a tap anywhere except
 * the cart controls falls through to the open layer.
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
        style={[styles.tile, { backgroundColor: tintFor(product.id) }, styles.passChildren]}
      >
        {/* Decorative for assistive tech: the open button above already announces all of this. */}
        <View style={[styles.imageBox, styles.passThrough]} aria-hidden>
          <ProductImage
            uri={product.image_url}
            name={product.name}
            faded={outOfStock}
            iconSize={36}
          />
        </View>
        {discount > 0 && !outOfStock ? (
          <View style={[styles.tab, styles.passThrough]} aria-hidden>
            <Foil />
            <Text variant="tag" color="forestDeep" style={styles.tabText}>
              {discount}% OFF
            </Text>
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
                size="xs"
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
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.name} to cart`}
                  style={({ pressed: down }) => [styles.add, down && styles.addPressed]}
                >
                  <Text variant="tag" color="forest" style={styles.addLabel}>
                    ADD
                  </Text>
                </PressableScale>
              </Animated.View>
            )
          ) : null}
        </View>
      </View>

      <View style={[styles.body, styles.passThrough]} aria-hidden>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {product.unit_label}
        </Text>
        <Text variant="label" numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Money paise={product.price_paise} variant="price" />
          {discount > 0 ? (
            <Money paise={product.mrp_paise} variant="micro" color="textTertiary" strike />
          ) : null}
        </View>
        {product.stock_hint === 'LOW' && !outOfStock ? (
          <Text variant="micro" color="goldDeep">
            Only a few left
          </Text>
        ) : discount > 0 && saving > 0 ? (
          <Text variant="micro" color="forestMid">
            Save {formatPaise(saving)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = StyleSheet.create({
  card: { flex: 1 },
  pressed: { opacity: 0.85 },
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
  tile: { aspectRatio: 1, borderRadius: radius.lg - 4 },
  imageBox: { flex: 1, padding: '15%' },
  tab: {
    position: 'absolute',
    top: 0,
    left: 8,
    overflow: 'hidden',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 4,
  },
  tabText: { fontSize: 9.5, lineHeight: 12 },
  control: { position: 'absolute', right: 6, bottom: -14 },
  add: {
    ...shadow.sm,
    shadowOpacity: 0.14,
    height: 32,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.forest,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { backgroundColor: colors.brandTint },
  addLabel: { fontSize: 12, letterSpacing: 0.8 },
  soldOut: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 14,
  },
  body: { paddingTop: 20, paddingHorizontal: 2, gap: 2 },
  name: { fontSize: 13, lineHeight: 17, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 },
});
