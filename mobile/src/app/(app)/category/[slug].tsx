import { router, Stack, useLocalSearchParams } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import type { ProductSort } from '@/api/catalog';
import { CartBar } from '@/components/CartBar';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { ProductGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState, Text } from '@/components/ui';
import { BigWordTabs } from '@/features/catalog/BigWordTabs';
import { useCategories, useCategory, useProducts } from '@/features/catalog/hooks';
import { colors, gutter, spacing } from '@/theme/tokens';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'default', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [sort, setSort] = useState<ProductSort>('default');
  const categories = useCategories();
  const category = useCategory(slug);
  const products = useProducts(category.data?.id, sort);

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total;
  const failed = category.isError ? category : products.isError ? products : null;

  return (
    <View style={styles.root}>
      {/* The big word below is the title; the bar keeps just the back button. */}
      <Stack.Screen options={{ title: '', headerBackTitle: 'Back' }} />

      {categories.data && categories.data.length > 1 ? (
        <BigWordTabs
          categories={categories.data}
          activeSlug={slug}
          onSelect={(next) => router.setParams({ slug: next })}
        />
      ) : (
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {category.data?.name ?? ''}
        </Text>
      )}

      {total !== undefined ? (
        <Text variant="caption" color="textSecondary" style={styles.count}>
          {total} {total === 1 ? 'item' : 'items'}
        </Text>
      ) : null}

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
        <View style={styles.pad}>
          <ProductGridSkeleton />
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
              message="The shop hasn't added products to this category."
            />
          }
          ListFooterComponent={
            products.isFetchingNextPage ? (
              <ActivityIndicator color={colors.forest} style={styles.footer} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ShopProductCard product={item} />
            </View>
          )}
        />
      )}
      <CartBar safeBottom />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { paddingHorizontal: gutter },
  count: { paddingHorizontal: gutter, marginTop: -2 },
  chips: { paddingHorizontal: gutter, paddingVertical: spacing.sm },
  pad: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  cell: { flex: 1 / 2 },
  footer: { paddingVertical: spacing.lg },
});
