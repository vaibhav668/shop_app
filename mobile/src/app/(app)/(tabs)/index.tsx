import { router } from 'expo-router';
import { ShoppingBasket } from 'lucide-react-native';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Banner } from '@/api/catalog';
import { BannerCarousel } from '@/components/BannerCarousel';
import { CategoryTile } from '@/components/product/CategoryTile';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { CategoryGridSkeleton, ProductCardSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHome } from '@/features/catalog/hooks';
import { greetingFor } from '@/lib/greeting';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const COLUMNS = 4;

function openBanner(banner: Banner) {
  if (banner.target_type === 'CATEGORY' && banner.target_slug) {
    router.push({ pathname: '/category/[slug]', params: { slug: banner.target_slug } });
  } else if (banner.target_type === 'PRODUCT' && banner.target_id) {
    router.push({ pathname: '/product/[id]', params: { id: banner.target_id } });
  }
}

export default function HomeScreen() {
  const { user } = useAuth();
  const home = useHome();
  const firstName = user?.name.split(' ')[0];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={home.refetch}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="title">
            {greetingFor(new Date())}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text variant="caption" color="textSecondary">
            Fresh groceries from Bada Bazar
          </Text>
        </View>

        <View style={styles.pad}>
          <SearchBar onPress={() => router.push('/search')} />
        </View>

        {home.isPending ? (
          <HomeSkeleton />
        ) : home.isError ? (
          <QueryError error={home.error} onRetry={home.refetch} />
        ) : home.data.categories.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title="Nothing here yet."
            message="Products will show up here once the shop adds them."
          />
        ) : (
          <>
            {home.data.banners.length > 0 ? (
              <View style={styles.section}>
                <BannerCarousel banners={home.data.banners} onOpen={openBanner} />
              </View>
            ) : null}

            <View style={[styles.section, styles.pad]}>
              <SectionHeader
                title="Shop by category"
                actionLabel="See all"
                onAction={() => router.push('/categories')}
              />
              <View style={styles.grid}>
                {home.data.categories.slice(0, 8).map((category) => (
                  <View key={category.id} style={styles.cell}>
                    <CategoryTile
                      category={category}
                      onPress={() =>
                        router.push({
                          pathname: '/category/[slug]',
                          params: { slug: category.slug },
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            </View>

            {home.data.featured.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.pad}>
                  <SectionHeader title="Fresh picks" />
                </View>
                <FlatList
                  horizontal
                  data={home.data.featured}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                  renderItem={({ item }) => (
                    <View style={styles.railCard}>
                      <ShopProductCard product={item} />
                    </View>
                  )}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeSkeleton() {
  return (
    <View style={[styles.section, styles.pad, { gap: spacing.xl }]} accessibilityLabel="Loading">
      <Skeleton height={148} radius={radius.xl} />
      <CategoryGridSkeleton count={8} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ width: 156 }}>
          <ProductCardSkeleton />
        </View>
        <View style={{ width: 156 }}>
          <ProductCardSkeleton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl },
  pad: { paddingHorizontal: gutter },
  header: { paddingHorizontal: gutter, paddingTop: spacing.sm, paddingBottom: spacing.md },
  section: { marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.sm },
  cell: { width: `${(100 - 3 * 3) / COLUMNS}%` },
  rail: { paddingHorizontal: gutter, gap: spacing.sm },
  railCard: { width: 156 },
});
