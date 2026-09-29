import { router, Stack, useLocalSearchParams } from 'expo-router';
import { PackageX } from 'lucide-react-native';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductDetail } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { CartBar } from '@/components/CartBar';
import { FavouriteButton } from '@/components/FavouriteButton';
import { ProductImage } from '@/components/product/ProductImage';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { QueryError } from '@/components/QueryError';
import {
  Badge,
  Button,
  EmptyState,
  Money,
  QuantityStepper,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { maxQuantityFor } from '@/features/cart/cartMath';
import { useCart, useCartControls } from '@/features/cart/hooks';
import { useProduct } from '@/features/catalog/hooks';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);

  if (isPending) return <ProductSkeleton />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={PackageX}
          title="This product isn't available"
          message="It may have been removed from the shop."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      );
    }
    return <QueryError error={error} onRetry={refetch} />;
  }
  return <ProductView product={product} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  const outOfStock = !product.is_available;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: () => <FavouriteButton productId={product.id} name={product.name} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWell}>
          <ProductImage uri={product.image_url} faded={outOfStock} iconSize={72} />
        </View>

        <View style={styles.info}>
          <Text variant="title">{product.name}</Text>
          <Text variant="body" color="textSecondary">
            {product.unit_label}
          </Text>

          <View style={styles.priceRow}>
            <Money paise={product.price_paise} variant="title" />
            {product.discount_percent > 0 ? (
              <>
                <Money paise={product.mrp_paise} variant="body" color="textTertiary" strike />
                <Badge label={`${product.discount_percent}% OFF`} tone="offer" />
              </>
            ) : null}
          </View>
          <Text variant="caption" color="textSecondary">
            MRP inclusive of all taxes
          </Text>

          <View style={styles.availability}>
            {outOfStock ? (
              <Badge label="Out of stock" tone="danger" />
            ) : product.stock_hint === 'LOW' ? (
              <Badge label="Only a few left" tone="warning" />
            ) : (
              <Badge label="In stock" tone="success" />
            )}
            {product.max_per_order ? (
              <Text variant="caption" color="textSecondary">
                Max {product.max_per_order} per order
              </Text>
            ) : null}
          </View>
        </View>

        {product.description ? (
          <View style={styles.section}>
            <SectionHeader title="About this item" />
            <Text variant="body" color="textSecondary">
              {product.description}
            </Text>
          </View>
        ) : null}

        {product.related.length > 0 ? (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <SectionHeader title={`More from ${product.category.name}`} />
            </View>
            <FlatList
              horizontal
              data={product.related}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
              renderItem={({ item }) => (
                <View style={styles.relatedCard}>
                  <ShopProductCard product={item} />
                </View>
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      <ProductActionBar product={product} />
    </View>
  );
}

/** Add to cart, then a stepper; the cart bar appears beneath once something is in the cart. */
function ProductActionBar({ product }: { product: ProductDetail }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const controls = useCartControls(product);
  const inCart = (controls?.quantity ?? 0) > 0;
  const hasCart = (cart.data?.item_count ?? 0) > 0;

  return (
    <View style={styles.actionArea}>
      <View style={[styles.action, !hasCart && { paddingBottom: spacing.sm + insets.bottom }]}>
        {!product.is_available ? (
          <Button title="Out of stock" disabled fullWidth />
        ) : inCart && controls ? (
          <View style={styles.inCart}>
            <Text variant="label" color="textSecondary">
              In your cart
            </Text>
            <QuantityStepper
              size="md"
              value={controls.quantity}
              max={maxQuantityFor(product)}
              onIncrement={controls.onIncrement}
              onDecrement={controls.onDecrement}
              itemName={product.name}
            />
          </View>
        ) : (
          <Button title="Add to cart" fullWidth disabled={!controls} onPress={controls?.onAdd} />
        )}
      </View>
      <CartBar safeBottom />
    </View>
  );
}

function ProductSkeleton() {
  return (
    <View style={[styles.root, styles.content]} accessibilityLabel="Loading product">
      <Skeleton height={320} radius={0} />
      <View style={styles.info}>
        <Skeleton height={26} width="75%" />
        <Skeleton height={16} width="30%" />
        <Skeleton height={28} width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  imageWell: {
    aspectRatio: 1,
    maxHeight: 360,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.xl,
  },
  info: { paddingHorizontal: gutter, paddingTop: spacing.md, gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.xl,
    marginHorizontal: gutter,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  relatedSection: { marginTop: spacing.xl },
  relatedHeader: { paddingHorizontal: gutter },
  relatedList: { paddingHorizontal: gutter, gap: spacing.sm },
  relatedCard: { width: 156 },
  actionArea: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { paddingHorizontal: gutter, paddingTop: spacing.sm },
  inCart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
});
