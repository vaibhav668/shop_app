import { router } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/product/CategoryTile';
import { CategoryGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState, Screen, ScreenTitle } from '@/components/ui';
import { useCategories } from '@/features/catalog/hooks';
import { colors, gutter, spacing } from '@/theme/tokens';

const COLUMNS = 3;

export default function CategoriesScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } = useCategories();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ScreenTitle>Categories</ScreenTitle>
      </View>
      {isPending ? (
        <View style={styles.pad}>
          <CategoryGridSkeleton />
        </View>
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[colors.brand]}
              tintColor={colors.brand}
            />
          }
          ListEmptyComponent={<EmptyState icon={LayoutGrid} title="Nothing here yet." />}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <CategoryTile
                category={item}
                onPress={() =>
                  router.push({ pathname: '/category/[slug]', params: { slug: item.slug } })
                }
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: gutter },
  pad: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl, gap: spacing.md },
  row: { gap: spacing.sm },
  cell: { flex: 1 / COLUMNS },
});
