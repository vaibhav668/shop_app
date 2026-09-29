import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type OrderScope, ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { OrderCard } from '@/components/OrderCard';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState, ScreenTitle, Skeleton } from '@/components/ui';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function OrdersScreen() {
  const [scope, setScope] = useState<OrderScope>('active');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <ScreenTitle>Orders</ScreenTitle>
        <View style={styles.tabs} accessibilityRole="tablist">
          <Chip label="Active" selected={scope === 'active'} onPress={() => setScope('active')} />
          <Chip label="Past" selected={scope === 'past'} onPress={() => setScope('past')} />
        </View>
      </View>
      <OrderList key={scope} scope={scope} />
    </SafeAreaView>
  );
}

function OrderList({ scope }: { scope: OrderScope }) {
  const orders = useInfiniteQuery({
    queryKey: queryKeys.orders(scope),
    queryFn: ({ pageParam }) => ordersApi.list(scope, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    staleTime: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Statuses move on while the customer is elsewhere; refresh whenever the tab comes back.
  const { refetch } = orders;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  if (orders.isPending) {
    return (
      <View style={styles.list} accessibilityLabel="Loading orders">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={104} radius={radius.lg} />
        ))}
      </View>
    );
  }
  if (orders.isError) return <QueryError error={orders.error} onRetry={orders.refetch} />;

  const items = orders.data.pages.flatMap((p) => p.items);
  return (
    <FlatList
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={[styles.list, items.length === 0 && styles.empty]}
      renderItem={({ item }) => <OrderCard order={item} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          colors={[colors.brand]}
          tintColor={colors.brand}
          onRefresh={async () => {
            setRefreshing(true);
            await orders.refetch();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={
        scope === 'active' ? (
          <EmptyState
            icon={ReceiptText}
            title="No orders on the way"
            message="Orders you place show up here until they're delivered."
            actionLabel="Start shopping"
            onAction={() => router.navigate('/')}
          />
        ) : (
          <EmptyState icon={ReceiptText} title="No past orders yet" />
        )
      }
      ListFooterComponent={
        orders.isFetchingNextPage ? (
          <ActivityIndicator color={colors.brand} style={styles.footer} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: gutter, paddingTop: spacing.xs, gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs },
  list: { padding: gutter, gap: spacing.sm, paddingBottom: spacing.xxxl },
  empty: { flexGrow: 1, justifyContent: 'center' },
  footer: { paddingVertical: spacing.lg },
});
