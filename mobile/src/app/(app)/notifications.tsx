import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Bell, BellRing } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { type AppNotification, notificationsApi } from '@/api/notifications';
import { queryKeys } from '@/api/queryClient';
import { QueryError } from '@/components/QueryError';
import { EmptyState, Skeleton, Text } from '@/components/ui';
import { routeFromData } from '@/features/notifications/push';
import { formatOrderTime } from '@/features/orders/orderStatus';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    staleTime: 0,
  });

  // Opening the list counts as reading it. Unread rows keep their highlight for this visit.
  const markedRead = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (markedRead.current) return;
      markedRead.current = true;
      void notificationsApi
        .readAll()
        .then(() => queryClient.setQueryData(queryKeys.unreadCount, { count: 0 }))
        .catch(() => {});
    }, [queryClient]),
  );

  if (list.isPending) {
    return (
      <View style={[styles.root, styles.list]} accessibilityLabel="Loading notifications">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={72} radius={radius.lg} />
        ))}
      </View>
    );
  }
  if (list.isError) return <QueryError error={list.error} onRetry={list.refetch} />;

  const items = list.data.pages.flatMap((p) => p.items);
  return (
    <FlatList
      style={styles.root}
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={[styles.list, items.length === 0 && styles.empty]}
      renderItem={({ item }) => <NotificationRow notification={item} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      ListEmptyComponent={
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          message="Updates about your orders will appear here."
        />
      }
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <ActivityIndicator color={colors.brand} style={styles.footer} />
        ) : null
      }
    />
  );
}

function NotificationRow({ notification: n }: { notification: AppNotification }) {
  const route = routeFromData(n.data);
  const unread = n.read_at === null;
  return (
    <Pressable
      disabled={!route}
      onPress={() => {
        const id = route?.split('/').pop();
        if (id) router.push({ pathname: '/orders/[id]', params: { id } });
      }}
      accessibilityRole={route ? 'button' : undefined}
      style={({ pressed }) => [styles.row, unread && styles.unread, pressed && styles.pressed]}
    >
      <View style={[styles.icon, unread && styles.iconUnread]}>
        <BellRing
          size={18}
          strokeWidth={1.75}
          color={unread ? colors.action : colors.textSecondary}
        />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{n.title}</Text>
        <Text variant="body" color="textSecondary">
          {n.body}
        </Text>
        <Text variant="caption" color="textTertiary">
          {formatOrderTime(n.created_at)}
        </Text>
      </View>
      {unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: gutter, gap: spacing.xs },
  empty: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  unread: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  pressed: { opacity: 0.85 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  iconUnread: { backgroundColor: colors.surface },
  text: { flex: 1, gap: 2 },
  dot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
  },
  footer: { paddingVertical: spacing.lg },
});
