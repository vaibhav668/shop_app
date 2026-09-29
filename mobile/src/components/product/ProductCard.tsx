import { Image } from 'expo-image';
import { ShoppingBasket } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge, Money, QuantityStepper, Text } from '@/components/ui';
import { discountPercent, formatPaise } from '@/lib/money';
import { colors, motion, radius, spacing } from '@/theme/tokens';

export type StockHint = 'IN_STOCK' | 'LOW' | 'OUT';

/** Mirrors the API's ProductCard DTO (docs/API_SPEC.md), in camelCase. */
export type ProductCardData = {
  id: string;
  name: string;
  unitLabel: string;
  pricePaise: number;
  mrpPaise: number;
  imageUrl: string | null;
  stockHint: StockHint;
};

export type ProductCardProps = {
  product: ProductCardData;
  quantity: number;
  maxQuantity?: number;
  onPress?: () => void;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

function ProductCardBase({
  product,
  quantity,
  maxQuantity,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
}: ProductCardProps) {
  const outOfStock = product.stockHint === 'OUT';
  const discount = discountPercent(product.pricePaise, product.mrpPaise);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.unitLabel}, ${formatPaise(product.pricePaise)}${
        outOfStock ? ', out of stock' : ''
      }`}
      style={styles.card}
    >
      <View style={styles.imageWell}>
        {product.imageUrl ? (
          <Image
            source={product.imageUrl}
            style={[styles.image, outOfStock && styles.faded]}
            contentFit="contain"
            transition={motion.base}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ShoppingBasket size={40} strokeWidth={1.5} color={colors.textTertiary} />
        )}
        {discount > 0 && !outOfStock ? (
          <View style={styles.tag}>
            <Badge label={`${discount}% OFF`} tone="offer" />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="label" numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {product.unitLabel}
        </Text>
        {product.stockHint === 'LOW' ? (
          <Text variant="micro" color="offerText">
            Only a few left
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View>
            <Money paise={product.pricePaise} variant="bodyStrong" />
            {discount > 0 ? (
              <Money paise={product.mrpPaise} variant="caption" color="textTertiary" strike />
            ) : null}
          </View>

          {outOfStock ? (
            <Text variant="micro" color="danger">
              Out of stock
            </Text>
          ) : quantity > 0 ? (
            <Animated.View key="stepper" entering={FadeIn.duration(motion.base)}>
              <QuantityStepper
                value={quantity}
                max={maxQuantity}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                itemName={product.name}
              />
            </Animated.View>
          ) : (
            <Animated.View key="add" entering={FadeIn.duration(motion.base)}>
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name} to cart`}
                style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
              >
                <Text variant="micro" color="action" style={styles.addLabel}>
                  ADD
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  imageWell: {
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  image: { width: '100%', height: '100%' },
  faded: { opacity: 0.5 },
  tag: { position: 'absolute', top: 6, left: 6 },
  body: { paddingTop: spacing.xs, paddingHorizontal: 2, gap: 2, flex: 1 },
  name: { minHeight: 40 },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  add: {
    height: 32,
    minWidth: 64,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.action,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { backgroundColor: colors.brandTint },
  addLabel: { fontSize: 13, letterSpacing: 0.5 },
});
