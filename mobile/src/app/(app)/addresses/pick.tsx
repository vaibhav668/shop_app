import { router } from 'expo-router';
import { Check, MapPinPlus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddressSummary } from '@/components/AddressCard';
import { QueryError } from '@/components/QueryError';
import { Skeleton, Text } from '@/components/ui';
import {
  resolveCheckoutAddress,
  selectCheckoutAddress,
  useAddresses,
  useSelectedCheckoutAddressId,
} from '@/features/addresses/hooks';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

/** Bottom sheet opened from Checkout: choose where this order goes. */
export default function PickAddressSheet() {
  const addresses = useAddresses();
  const chosenId = useSelectedCheckoutAddressId();
  const current = resolveCheckoutAddress(addresses.data, chosenId);

  if (addresses.isError) return <QueryError error={addresses.error} onRetry={addresses.refetch} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="heading" accessibilityRole="header">
        Deliver to
      </Text>
      {addresses.isPending ? (
        <Skeleton height={88} radius={radius.lg} />
      ) : (
        addresses.data.map((address) => {
          const selected = address.id === current?.id;
          return (
            <Pressable
              key={address.id}
              onPress={() => {
                selectCheckoutAddress(address.id);
                router.back();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && !selected && styles.optionPressed,
              ]}
            >
              <AddressSummary
                address={address}
                trailing={
                  selected ? <Check size={20} color={colors.action} strokeWidth={2.25} /> : null
                }
              />
            </Pressable>
          );
        })
      )}
      <Pressable
        onPress={() => router.replace({ pathname: '/addresses/form', params: { select: '1' } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addRow, pressed && styles.optionPressed]}
      >
        <MapPinPlus size={20} strokeWidth={1.75} color={colors.action} />
        <Text variant="bodyStrong" color="action">
          Add a new address
        </Text>
      </Pressable>
      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: gutter, gap: spacing.sm, backgroundColor: colors.surface },
  option: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.brand, borderWidth: 2, padding: spacing.md - 1 },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  spacer: { height: spacing.lg },
});
