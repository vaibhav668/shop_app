import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { ProductCard } from '@/api/catalog';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { Text } from '@/components/ui';
import { useAppWidth } from '@/lib/layout';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const GAP = spacing.sm + 2;

/** A card width that shows three cards and a sliver of the fourth, so the row reads as swipeable. */
export function useRailCardWidth(): number {
  const width = useAppWidth();
  return Math.floor((width - gutter - GAP * 3) / 3.25);
}

export type ProductRailProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  products: ProductCard[];
  onSeeAll?: () => void;
};

/** A titled, sideways-scrolling row of compact product cards. */
export function ProductRail({ title, subtitle, icon: Icon, products, onSeeAll }: ProductRailProps) {
  const cardWidth = useRailCardWidth();
  if (products.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        {Icon ? (
          <View style={styles.icon}>
            <Icon size={15} strokeWidth={2.4} color={colors.goldBright} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            style={styles.seeAll}
          >
            <Text variant="tag" color="forest">
              See all
            </Text>
            <ChevronRight size={14} strokeWidth={2.6} color={colors.forest} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        // Rails are short; render them fully so cards don't pop in while swiping.
        initialNumToRender={8}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <ShopProductCard product={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: gutter,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.brandTint,
  },
  row: { paddingHorizontal: gutter, gap: GAP },
});
