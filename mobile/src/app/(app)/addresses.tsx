import { router } from 'expo-router';
import { MapPinPlus, MapPinned } from 'lucide-react-native';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Address } from '@/api/addresses';
import { ApiError } from '@/api/client';
import { AddressSummary } from '@/components/AddressCard';
import { QueryError } from '@/components/QueryError';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Skeleton, Text } from '@/components/ui';
import { useAddresses, useAddressMutations } from '@/features/addresses/hooks';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export default function AddressesScreen() {
  const addresses = useAddresses();
  const insets = useSafeAreaInsets();
  const add = () => router.push('/addresses/form');

  if (addresses.isPending) {
    return (
      <View style={[styles.root, styles.list]} accessibilityLabel="Loading addresses">
        <Skeleton height={96} radius={radius.lg} />
        <Skeleton height={96} radius={radius.lg} />
      </View>
    );
  }
  if (addresses.isError) {
    return <QueryError error={addresses.error} onRetry={addresses.refetch} />;
  }
  if (addresses.data.length === 0) {
    return (
      <EmptyState
        icon={MapPinned}
        title="No saved addresses"
        message="Add where you'd like your groceries delivered."
        actionLabel="Add address"
        onAction={add}
      />
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={addresses.data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <AddressRow address={item} />}
      />
      <View style={[styles.footer, { paddingBottom: spacing.sm + insets.bottom }]}>
        <Button title="Add address" icon={MapPinPlus} fullWidth onPress={add} />
      </View>
    </View>
  );
}

function AddressRow({ address }: { address: Address }) {
  const { remove, setDefault } = useAddressMutations();
  const toast = useToast();
  const fail = (e: unknown) =>
    toast.show(e instanceof ApiError ? e.message : 'Something went wrong. Try again?');

  const confirmDelete = () =>
    Alert.alert(`Delete "${address.label}"?`, 'You can add it again any time.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(address.id, { onError: fail }),
      },
    ]);

  return (
    <View style={styles.card}>
      <AddressSummary address={address} />
      <View style={styles.actions}>
        <Action
          label="Edit"
          onPress={() => router.push({ pathname: '/addresses/form', params: { id: address.id } })}
        />
        {!address.is_default ? (
          <Action
            label="Make default"
            onPress={() => setDefault.mutate(address.id, { onError: fail })}
          />
        ) : null}
        <Action label="Delete" danger onPress={confirmDelete} />
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text variant="label" color={danger ? 'danger' : 'action'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: gutter, gap: spacing.sm },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: 20 + spacing.sm, // line up with the text, past the icon
  },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  actionPressed: { backgroundColor: colors.surfaceMuted },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
