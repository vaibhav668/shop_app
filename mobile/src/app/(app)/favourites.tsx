import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { favouritesApi } from '@/api/cart';
import { queryKeys } from '@/api/queryClient';
import { CartBar } from '@/components/CartBar';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { ProductGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState } from '@/components/ui';
import { colors, gutter, spacing } from '@/theme/tokens';
import { useGridCell } from '@/lib/useGridCell';

export default function FavouritesScreen() {
  const cell = useGridCell(2);
  const favourites = useInfiniteQuery({
    queryKey: queryKeys.favourites,
    queryFn: ({ pageParam }) => favouritesApi.list(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  });
  const items = favourites.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={styles.root}>
      {favourites.isPending ? (
        <View style={styles.pad}>
          <ProductGridSkeleton />
        </View>
      ) : favourites.isError ? (
        <QueryError error={favourites.error} onRetry={favourites.refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (favourites.hasNextPage && !favourites.isFetchingNextPage) {
              favourites.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <EmptyState
              icon={Heart}
              title="No favourites yet"
              message="Tap the heart on any product to find it here quickly."
              actionLabel="Start shopping"
              onAction={() => router.dismissTo('/')}
            />
          }
          ListFooterComponent={
            favourites.isFetchingNextPage ? (
              <ActivityIndicator color={colors.brand} style={styles.footer} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={cell}>
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
  pad: { padding: gutter },
  list: { padding: gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  footer: { paddingVertical: spacing.lg },
});
