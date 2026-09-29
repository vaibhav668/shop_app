import { router, Stack, useLocalSearchParams } from 'expo-router';
import { PackageOpen } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import type { ProductSort } from '@/api/catalog';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState } from '@/components/ui';
import { useCategory, useProducts } from '@/features/catalog/hooks';
import { colors, gutter, spacing } from '@/theme/tokens';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'default', label: 'Popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [sort, setSort] = useState<ProductSort>('default');
  const category = useCategory(slug);
  const products = useProducts(category.data?.id, sort);

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const failed = category.isError ? category : products.isError ? products : null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: category.data?.name ?? '' }} />

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
          ListEmptyComponent={<EmptyState icon={PackageOpen} title="Nothing here yet." />}
          ListFooterComponent={
            products.isFetchingNextPage ? (
              <ActivityIndicator color={colors.brand} style={styles.footer} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ProductCard
                product={item}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chips: { paddingHorizontal: gutter, paddingBottom: spacing.sm },
  pad: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  cell: { flex: 1 / 2 },
  footer: { paddingVertical: spacing.lg },
});
