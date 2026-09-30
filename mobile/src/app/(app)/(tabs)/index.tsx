import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { Moon, ShoppingBasket, Sparkles } from 'lucide-react-native';
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

import type { Banner } from '@/api/catalog';
import { BannerCarousel } from '@/components/BannerCarousel';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { ProductCardSkeleton } from '@/components/product/Skeletons';
import { QueryError } from '@/components/QueryError';
import { EmptyState, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHome, useShop } from '@/features/catalog/hooks';
import { CategoryBubbles } from '@/features/home/CategoryBubbles';
import { HomeHeader } from '@/features/home/HomeHeader';
import { HomeSearch, MiniHeader } from '@/features/home/HomeSearch';
import { PromiseTiles } from '@/features/home/PromiseTiles';
import { useUnreadCount } from '@/features/notifications/hooks';
import { colors, gutter, radius, spacing } from '@/theme/tokens';
import { useGridCell } from '@/lib/useGridCell';

// Past this point the big header is gone and the slim search bar slides in.
const COLLAPSE_AT = 150;

function openBanner(banner: Banner) {
  if (banner.target_type === 'CATEGORY' && banner.target_slug) {
    router.push({ pathname: '/category/[slug]', params: { slug: banner.target_slug } });
  } else if (banner.target_type === 'PRODUCT' && banner.target_id) {
    router.push({ pathname: '/product/[id]', params: { id: banner.target_id } });
  }
}

export default function HomeScreen() {
  const cell = useGridCell(2);
  const { user } = useAuth();
  const home = useHome();
  const shop = useShop();
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
        <HomeSearch />

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

            {home.data.banners.length > 0 ? (
              <View style={styles.section}>
                <BannerCarousel banners={home.data.banners} onOpen={openBanner} />
              </View>
            ) : null}

            {shop.data ? <PromiseTiles shop={shop.data} /> : null}

            {home.data.featured.length > 0 ? (
              <View style={[styles.section, styles.pad]}>
                <View style={styles.picksHead}>
                  <View style={styles.picksIcon}>
                    <Sparkles size={16} strokeWidth={2.2} color={colors.goldBright} />
                  </View>
                  <View>
                    <Text variant="title" accessibilityRole="header">
                      Fresh picks
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Chosen by the shop today
                    </Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  {home.data.featured.slice(0, 10).map((product) => (
                    <View key={product.id} style={cell}>
                      <ShopProductCard product={product} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={[styles.pad, styles.skeleton]} accessibilityLabel="Loading">
      <View style={styles.skeletonRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={64} height={64} radius={32} />
        ))}
      </View>
      <Skeleton height={156} radius={radius.xl} />
      <View style={styles.grid}>
        <View style={styles.cell}>
          <ProductCardSkeleton />
        </View>
        <View style={styles.cell}>
          <ProductCardSkeleton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  pad: { paddingHorizontal: gutter },
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
  picksHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 14 },
  picksIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md - 2,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '48.4%' },
  skeleton: { marginTop: spacing.lg, gap: spacing.lg },
  skeletonRow: { flexDirection: 'row', gap: spacing.sm },
});
