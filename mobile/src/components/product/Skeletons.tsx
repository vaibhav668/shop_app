import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={140} radius={radius.sm} />
      <Skeleton height={14} width="85%" />
      <Skeleton height={12} width="40%" />
      <Skeleton height={18} width="35%" />
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid} accessibilityLabel="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.cell}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.grid} accessibilityLabel="Loading categories">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.categoryCell}>
          <Skeleton height={96} radius={radius.lg} />
          <Skeleton height={12} width="70%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '48%' },
  categoryCell: { width: '30%', gap: spacing.xs, alignItems: 'center' },
});
