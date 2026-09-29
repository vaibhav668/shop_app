import { Briefcase, Home, MapPin } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Address } from '@/api/addresses';
import { Badge, Text } from '@/components/ui';
import { formatAddress } from '@/features/addresses/addressForm';
import { colors, spacing } from '@/theme/tokens';

function LabelIcon({ label }: { label: string }) {
  const l = label.trim().toLowerCase();
  const props = { size: 20, strokeWidth: 1.75, color: colors.brand };
  if (l === 'home') return <Home {...props} />;
  if (l === 'work' || l === 'office') return <Briefcase {...props} />;
  return <MapPin {...props} />;
}

/** The address body used in the list, the picker and at checkout. Callers add the frame. */
export function AddressSummary({
  address,
  showDefault = true,
  trailing,
}: {
  address: Address;
  showDefault?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <LabelIcon label={address.label} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong">{address.label}</Text>
          {showDefault && address.is_default ? <Badge label="Default" tone="success" /> : null}
          {!address.is_serviceable ? <Badge label="Not delivered here" tone="danger" /> : null}
        </View>
        <Text variant="body" color="textSecondary">
          {formatAddress(address)}
        </Text>
        <Text variant="caption" color="textSecondary" tabular>
          {address.recipient_name} · +91 {address.phone}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
