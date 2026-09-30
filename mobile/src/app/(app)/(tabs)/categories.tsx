import { router } from 'expo-router';
import { LayoutGrid, Search } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { CategoryTile } from '@/components/product/CategoryTile';
import { CategoryGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { useCategories } from '@/features/catalog/hooks';
import { colors, gutter, spacing } from '@/theme/tokens';
import { useGridCell } from '@/lib/useGridCell';

const COLUMNS = 3;

export default function CategoriesScreen() {
  const cell = useGridCell(COLUMNS);
  const { data, isPending, isError, error, refetch, isRefetching } = useCategories();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="display" accessibilityRole="header">
            Categories
          </Text>
          <Text variant="caption" color="textSecondary">
            Everything the shop stocks, aisle by aisle
          </Text>
        </View>
        <IconButton
          icon={Search}
          accessibilityLabel="Search"
          outlined
          onPress={() => router.push('/search')}
        />
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
              colors={[colors.forest]}
              tintColor={colors.forest}
            />
          }
          ListEmptyComponent={<EmptyState icon={LayoutGrid} title="Nothing here yet." />}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInUp.delay(Math.min(index, 12) * 30).duration(280)}
              style={cell}
            >
              <CategoryTile
                category={item}
                onPress={() =>
                  router.push({ pathname: '/category/[slug]', params: { slug: item.slug } })
                }
              />
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titles: { flex: 1 },
  pad: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
});
