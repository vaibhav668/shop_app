import { router } from 'expo-router';
import { ShoppingBasket } from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/product/CategoryTile';
import { CategoryGridSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCategories } from '@/features/catalog/hooks';
import { greetingFor } from '@/lib/greeting';
import { colors, gutter, spacing } from '@/theme/tokens';

const COLUMNS = 4;

export default function HomeScreen() {
  const { user } = useAuth();
  const categories = useCategories();
  const firstName = user?.name.split(' ')[0];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={categories.isRefetching}
            onRefresh={categories.refetch}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="display">
            {greetingFor(new Date())}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text variant="body" color="textSecondary">
            Fresh groceries from Bada Bazar
          </Text>
        </View>

        <SectionHeader
          title="Shop by category"
          actionLabel={categories.data?.length ? 'See all' : undefined}
          onAction={() => router.push('/categories')}
        />
        {categories.isPending ? (
          <CategoryGridSkeleton />
        ) : categories.isError ? (
          <QueryError error={categories.error} onRetry={categories.refetch} />
        ) : categories.data.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title="Nothing here yet."
            message="Products will show up here once the shop adds them."
          />
        ) : (
          <View style={styles.grid}>
            {categories.data.map((category) => (
              <View key={category.id} style={styles.cell}>
                <CategoryTile
                  category={category}
                  onPress={() =>
                    router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xxs, paddingVertical: spacing.md, marginBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.sm },
  cell: { width: `${(100 - 3 * 3) / COLUMNS}%` },
});
