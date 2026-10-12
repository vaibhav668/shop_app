import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, PackageOpen, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductSort } from '@/api/catalog';
import { CartBar } from '@/components/CartBar';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { ProductCardSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState, IconButton, Text } from '@/components/ui';
import { AISLE_RAIL_WIDTH, AisleRail } from '@/features/catalog/AisleRail';
import { useCategories, useCategory, useProducts } from '@/features/catalog/hooks';
import { useAppWidth } from '@/lib/layout';
import { colors, spacing } from '@/theme/tokens';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'default', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const PAD = spacing.sm;
const GAP = spacing.sm;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const appWidth = useAppWidth();
  const [sort, setSort] = useState<ProductSort>('default');
  const categories = useCategories();
  const category = useCategory(slug);
  const products = useProducts(category.data?.id, sort);

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total;
  const failed = category.isError ? category : products.isError ? products : null;
  // Two equal columns in the space beside the aisle rail.
  const cardWidth = Math.floor((appWidth - AISLE_RAIL_WIDTH - PAD * 2 - GAP) / 2);

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <View style={styles.titles}>
          <Text variant="heading" numberOfLines={1} accessibilityRole="header">
            {category.data?.name ?? ''}
          </Text>
          {total !== undefined ? (
            <Text variant="micro" color="textSecondary">
              {total} {total === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon={Search}
          accessibilityLabel="Search"
          outlined
          onPress={() => router.push('/search')}
        />
      </View>

      <View style={styles.body}>
        {categories.data && categories.data.length > 0 ? (
          <AisleRail
            categories={categories.data}
            activeSlug={slug}
            onSelect={(next) => {
              if (next !== slug) router.setParams({ slug: next });
            }}
          />
        ) : (
          <View style={styles.railPlaceholder} />
        )}

        <View style={styles.main}>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {SORTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={sort === s.value}
                  onPress={() => setSort(s.value)}
                />
              ))}
            </ScrollView>
          </View>

          {failed ? (
            <QueryError error={failed.error} onRetry={() => failed.refetch()} />
          ) : category.isPending || products.isPending ? (
            <View style={styles.skeleton} accessibilityLabel="Loading products">
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={{ width: cardWidth }}>
                  <ProductCardSkeleton />
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.list}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
              }}
              ListEmptyComponent={
                <EmptyState
                  icon={PackageOpen}
                  title="Nothing here yet."
                  message="The shop hasn't added products to this aisle."
                />
              }
              ListFooterComponent={
                products.isFetchingNextPage ? (
                  <ActivityIndicator color={colors.forest} style={styles.footer} />
                ) : null
              }
              renderItem={({ item }) => (
                <View style={{ width: cardWidth }}>
                  <ShopProductCard product={item} />
                </View>
              )}
            />
          )}
        </View>
      </View>
      <CartBar safeBottom />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titles: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  railPlaceholder: { width: AISLE_RAIL_WIDTH, backgroundColor: colors.surface },
  main: { flex: 1 },
  chips: { paddingHorizontal: PAD, paddingVertical: spacing.sm },
  list: { paddingHorizontal: PAD, paddingBottom: 140, rowGap: spacing.lg },
  row: { gap: GAP },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  footer: { paddingVertical: spacing.lg },
});
