import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Minus,
  Package,
  PackageX,
  Plus,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
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
  IconButton,
  Money,
  PressableScale,
  Skeleton,
  Text,
} from '@/components/ui';
import { maxQuantityFor } from '@/features/cart/cartMath';
import { useCart, useCartControls } from '@/features/cart/hooks';
import { useProduct, useShop } from '@/features/catalog/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, shadow, spacing, tintFor } from '@/theme/tokens';

const HERO = 320;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);

  if (isPending) return <ProductSkeleton />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <View style={styles.center}>
          <EmptyState
            icon={PackageX}
            title="This product isn't available"
            message="It may have been removed from the shop."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <QueryError error={error} onRetry={refetch} />
      </View>
    );
  }
  return <ProductView product={product} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  const insets = useSafeAreaInsets();
  const shop = useShop();
  const outOfStock = !product.is_available;
  const saving = product.mrp_paise - product.price_paise;
  const [aboutOpen, setAboutOpen] = useState(true);
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // The picture drifts down and shrinks a little as the sheet slides over it.
  const heroStyle = useAnimatedStyle(() => {
    const y = Math.max(0, Math.min(scrollY.value, HERO));
    return { transform: [{ translateY: y * 0.4 }, { scale: 1 - y / 1000 }] };
  });
  // A solid bar with the name fades in once the picture has scrolled away.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO - 140, HERO - 80], [0, 1], 'clamp'),
  }));

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.hero, { backgroundColor: tintFor(product.id) }]}>
          <View style={styles.halo} />
          <View style={styles.ring} />
          <Animated.View style={[styles.heroImage, heroStyle]}>
            <ProductImage uri={product.image_url} faded={outOfStock} iconSize={84} />
          </Animated.View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/category/[slug]',
                params: { slug: product.category.slug },
              })
            }
            accessibilityRole="link"
            style={styles.crumb}
          >
            <Text variant="tag" color="crust">
              {product.category.name.toUpperCase()}
            </Text>
            <ChevronRight size={12} strokeWidth={2.6} color={colors.crust} />
          </Pressable>
          <Text variant="display" accessibilityRole="header">
            {product.name}
          </Text>
          <Text variant="body" color="textSecondary">
            {product.unit_label}
          </Text>

          <View style={styles.priceRow}>
            <Money paise={product.price_paise} variant="priceLg" />
            {product.discount_percent > 0 ? (
              <>
                <Money paise={product.mrp_paise} variant="body" color="textTertiary" strike />
                <Badge label={`${product.discount_percent}% OFF`} tone="foil" />
              </>
            ) : null}
          </View>
          {saving > 0 ? (
            <Text variant="label" color="brand">
              You save {formatPaise(saving)}
            </Text>
          ) : null}
          <Text variant="caption" color="textTertiary">
            MRP inclusive of all taxes
          </Text>

          <View style={styles.stats}>
            <Stat
              icon={
                outOfStock ? PackageX : product.stock_hint === 'LOW' ? TriangleAlert : CircleCheck
              }
              tone={outOfStock ? 'danger' : product.stock_hint === 'LOW' ? 'goldDeep' : 'brand'}
              title={
                outOfStock
                  ? 'Out of stock'
                  : product.stock_hint === 'LOW'
                    ? 'A few left'
                    : 'In stock'
              }
              caption={outOfStock ? 'check back soon' : 'ready to pack'}
            />
            <Stat
              icon={Clock}
              tone="gold"
              title={shop.data ? `${shop.data.delivery_eta_minutes} min` : '—'}
              caption="delivery"
            />
            <Stat icon={Package} tone="text" title={product.unit_label} caption="pack size" />
          </View>
          {product.max_per_order ? (
            <Text variant="caption" color="textSecondary" style={styles.limit}>
              Max {product.max_per_order} per order
            </Text>
          ) : null}

          {product.description ? (
            <Animated.View layout={LinearTransition} style={styles.about}>
              <Pressable
                onPress={() => setAboutOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aboutOpen }}
                style={styles.aboutHead}
              >
                <Text variant="heading">About this item</Text>
                <View style={aboutOpen && styles.chevronOpen}>
                  <ChevronRight size={18} strokeWidth={2.4} color={colors.text} />
                </View>
              </Pressable>
              {aboutOpen ? (
                <Animated.View entering={FadeIn.duration(220)}>
                  <Text variant="body" color="textSecondary">
                    {product.description}
                  </Text>
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        {product.related.length > 0 ? (
          <View style={styles.related}>
            <Text variant="heading" style={styles.relatedTitle}>
              More from {product.category.name}
            </Text>
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
      </Animated.ScrollView>

      {/* Floating top controls, with a solid bar that fades in on scroll. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View style={[styles.topBarFill, barStyle]} pointerEvents="none">
          <Text variant="heading" numberOfLines={1} style={styles.topTitle}>
            {product.name}
          </Text>
        </Animated.View>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel="Back"
          outlined
          onPress={() => router.back()}
        />
        <FavouriteButton productId={product.id} name={product.name} floating />
      </View>

      <BuyBar product={product} />
    </View>
  );
}

type StatTone = 'brand' | 'gold' | 'goldDeep' | 'danger' | 'text';

function Stat({
  icon: Icon,
  tone,
  title,
  caption,
}: {
  icon: typeof Clock;
  tone: StatTone;
  title: string;
  caption: string;
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${title}, ${caption}`}>
      <Icon size={16} strokeWidth={2.2} color={colors[tone]} />
      <Text variant="label" numberOfLines={1} style={styles.statTitle}>
        {title}
      </Text>
      <Text variant="micro" color="textSecondary" numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** Price on the left; Add to cart grows into a full-width stepper once it's in the cart. */
function BuyBar({ product }: { product: ProductDetail }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const controls = useCartControls(product);
  const quantity = controls?.quantity ?? 0;
  const hasCart = (cart.data?.item_count ?? 0) > 0;
  const max = maxQuantityFor(product);

  return (
    <View style={styles.buyArea}>
      <View style={[styles.buy, !hasCart && { paddingBottom: spacing.sm + insets.bottom }]}>
        <View style={styles.total}>
          <Text variant="micro" color="textSecondary">
            {quantity > 1 ? `${quantity} × ${formatPaise(product.price_paise)}` : 'Price'}
          </Text>
          <Money paise={product.price_paise * Math.max(1, quantity)} variant="priceLg" />
        </View>
        {!product.is_available ? (
          <View style={styles.flex}>
            <Button title="Out of stock" disabled fullWidth />
          </View>
        ) : quantity > 0 && controls ? (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.flex, styles.stepper]}>
            <PressableScale
              onPress={controls.onDecrement}
              scaleTo={0.88}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${product.name}`}
              style={styles.stepBtn}
            >
              <Minus size={18} strokeWidth={2.6} color={colors.goldBright} />
            </PressableScale>
            <Text variant="button" color="onAction" accessibilityLiveRegion="polite">
              {quantity} in cart
            </Text>
            <PressableScale
              onPress={controls.onIncrement}
              disabled={quantity >= max}
              scaleTo={0.88}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${product.name}`}
              accessibilityState={{ disabled: quantity >= max }}
              style={[styles.stepBtn, quantity >= max && styles.dim]}
            >
              <Plus size={18} strokeWidth={2.6} color={colors.goldBright} />
            </PressableScale>
          </Animated.View>
        ) : (
          <View style={styles.flex}>
            <Button
              title="Add to cart"
              icon={ShoppingBag}
              fullWidth
              disabled={!controls}
              onPress={controls?.onAdd}
            />
          </View>
        )}
      </View>
      <CartBar safeBottom />
    </View>
  );
}

function ProductSkeleton() {
  return (
    <View style={styles.root} accessibilityLabel="Loading product">
      <Skeleton height={HERO} radius={0} />
      <View style={[styles.sheet, styles.skeletonSheet]}>
        <Skeleton height={12} width="30%" />
        <Skeleton height={28} width="75%" />
        <Skeleton height={16} width="25%" />
        <Skeleton height={30} width="40%" />
        <View style={styles.stats}>
          <Skeleton height={64} width="31%" radius={radius.md} />
          <Skeleton height={64} width="31%" radius={radius.md} />
          <Skeleton height={64} width="31%" radius={radius.md} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl, backgroundColor: colors.surface },
  hero: { height: HERO, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  halo: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  ring: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.forest,
    opacity: 0.15,
  },
  heroImage: { width: 200, height: 200, marginTop: 30 },
  sheet: {
    marginTop: -28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: gutter + 4,
    paddingTop: spacing.lg,
    gap: 4,
  },
  skeletonSheet: { gap: spacing.sm },
  grabber: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  statTitle: { fontSize: 13 },
  limit: { marginTop: spacing.xs },
  about: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg - 4,
    backgroundColor: colors.bg,
    gap: spacing.xs,
  },
  aboutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  related: { marginTop: spacing.xl },
  relatedTitle: { paddingHorizontal: gutter + 4, marginBottom: spacing.sm },
  relatedList: { paddingHorizontal: gutter, gap: spacing.sm, paddingBottom: spacing.sm },
  relatedCard: { width: 160 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: gutter - 4,
    paddingBottom: spacing.xs,
  },
  topBarFill: {
    ...shadow.sm,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: 70,
  },
  topTitle: { textAlign: 'center' },
  buyArea: { ...shadow.md, backgroundColor: colors.surface },
  buy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
  },
  total: { minWidth: 88 },
  flex: { flex: 1 },
  stepper: {
    ...shadow.md,
    shadowOpacity: 0.25,
    height: 52,
    borderRadius: radius.md + 2,
    backgroundColor: colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 2,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.4 },
});
