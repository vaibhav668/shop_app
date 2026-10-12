import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { BadgePercent, History, Moon, ShoppingBasket, Sparkles, Tag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import type { Banner, ProductCard } from '@/api/catalog';
import { BannerCarousel } from '@/components/BannerCarousel';
import { ProductCardSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBuyAgain, useHome, useShop } from '@/features/catalog/hooks';
import { CategoryBubbles } from '@/features/home/CategoryBubbles';
import { HomeHeader } from '@/features/home/HomeHeader';
import { MiniHeader } from '@/features/home/HomeSearch';
import { ProductRail, useRailCardWidth } from '@/features/home/ProductRail';
import { PromiseTiles } from '@/features/home/PromiseTiles';
import { useUnreadCount } from '@/features/notifications/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

// Past this point the header has scrolled away and the slim search bar slides in.
const COLLAPSE_AT = 220;

function openBanner(banner: Banner) {
  if (banner.target_type === 'CATEGORY' && banner.target_slug) {
    router.push({ pathname: '/category/[slug]', params: { slug: banner.target_slug } });
  } else if (banner.target_type === 'PRODUCT' && banner.target_id) {
    router.push({ pathname: '/product/[id]', params: { id: banner.target_id } });
  }
}

function withoutRepeats(list: ProductCard[], shown: ProductCard[]): ProductCard[] {
  const seen = new Set(shown.map((p) => p.id));
  const rest = list.filter((p) => !seen.has(p.id));
  return rest.length >= 3 ? rest : [];
}

const openCategory = (slug: string) =>
  router.push({ pathname: '/category/[slug]', params: { slug } });

export default function HomeScreen() {
  const { user } = useAuth();
  const home = useHome();
  const shop = useShop();
  const buyAgain = useBuyAgain();
  const unread = useUnreadCount();
  const [collapsed, setCollapsed] = useState(false);
  const eta = shop.data?.delivery_eta_minutes;

  // The header is forest green: light status-bar icons while Home is on screen.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setCollapsed(e.nativeEvent.contentOffset.y > COLLAPSE_AT);

  const refresh = () => {
    void home.refetch();
    void shop.refetch();
    void buyAgain.refetch();
  };

  return (
    <View style={styles.root}>
      {collapsed ? <MiniHeader etaMinutes={eta} /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={refresh}
            colors={[colors.forest]}
            tintColor={colors.goldBright}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <HomeHeader name={user?.name} unread={unread} etaMinutes={eta} />

        {shop.data && !shop.data.is_accepting_orders ? (
          <View style={styles.closed} accessibilityRole="alert">
            <Moon size={18} strokeWidth={2} color={colors.goldDeep} />
            <Text variant="label" color="goldDeep" style={styles.closedText}>
              {shop.data.closed_message}
            </Text>
          </View>
        ) : null}

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
          <Animated.View entering={FadeInUp.duration(320)}>
            <CategoryBubbles categories={home.data.categories} />

            <ProductRail
              title="Buy again"
              subtitle="What you order most"
              icon={History}
              products={buyAgain.data ?? []}
            />

            {home.data.banners.length > 0 ? (
              <View style={styles.section}>
                <BannerCarousel banners={home.data.banners} onOpen={openBanner} />
              </View>
            ) : null}

            <ProductRail
              title="Fresh picks"
              subtitle="Chosen by the shop today"
              icon={Sparkles}
              products={home.data.featured}
            />
            <ProductRail
              title={`Under ${formatPaise(home.data.under_price_paise)}`}
              subtitle="Small price, full basket"
              icon={Tag}
              products={home.data.under_price}
            />
            <ProductRail
              title="Biggest savings"
              subtitle="The most off MRP right now"
              icon={BadgePercent}
              // Skip what the Under-price rail already shows, so the rails don't repeat.
              products={withoutRepeats(home.data.deals, home.data.under_price)}
            />

            {shop.data ? <PromiseTiles shop={shop.data} /> : null}

            {home.data.rails.map((rail) => (
              <ProductRail
                key={rail.category.id}
                title={rail.category.name}
                products={rail.products}
                onSeeAll={() => openCategory(rail.category.slug)}
              />
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  const cardWidth = useRailCardWidth();
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading">
      <View style={styles.skeletonRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={64} height={64} radius={32} />
        ))}
      </View>
      <Skeleton height={20} width="40%" />
      <View style={styles.skeletonRow}>
        {Array.from({ length: 3 }, (_, i) => (
          <View key={i} style={{ width: cardWidth }}>
            <ProductCardSkeleton />
          </View>
        ))}
      </View>
      <Skeleton height={156} radius={radius.xl} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  section: { marginTop: spacing.lg },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: gutter,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg - 4,
    backgroundColor: colors.goldSoft,
  },
  closedText: { flex: 1 },
  skeleton: { paddingHorizontal: gutter, marginTop: spacing.lg, gap: spacing.md },
  skeletonRow: { flexDirection: 'row', gap: spacing.sm },
});
