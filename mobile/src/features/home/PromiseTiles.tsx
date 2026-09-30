import type { LucideIcon } from 'lucide-react-native';
import { Leaf, Truck, Wallet, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Shop } from '@/api/catalog';
import { Text } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

type Tile = { key: string; small: string; big: string; icon: LucideIcon; tint: string };

/** Three soft tiles with the shop's real promises: speed, free delivery, paying at the door. */
export function PromiseTiles({ shop }: { shop: Shop }) {
  const tiles: Tile[] = [
    {
      key: 'eta',
      small: 'Delivery in',
      big: `${shop.delivery_eta_minutes} min`,
      icon: Zap,
      tint: colors.tintMint,
    },
    shop.delivery_fee_paise === 0
      ? { key: 'free', small: 'Delivery', big: 'Always free', icon: Truck, tint: colors.tintButter }
      : {
          key: 'free',
          small: 'Free delivery',
          big: `Over ${formatPaise(shop.free_delivery_above_paise)}`,
          icon: Truck,
          tint: colors.tintButter,
        },
    shop.cod_enabled
      ? {
          key: 'pay',
          small: 'Cash or UPI',
          big: 'Pay at door',
          icon: Wallet,
          tint: colors.tintPeach,
        }
      : { key: 'pay', small: 'Picked', big: 'Fresh daily', icon: Leaf, tint: colors.tintPeach },
  ];

  return (
    <View style={styles.row}>
      {tiles.map(({ key, small, big, icon: Icon, tint }) => (
        <View
          key={key}
          style={[styles.tile, { backgroundColor: tint }]}
          accessible
          accessibilityLabel={`${small} ${big}`}
        >
          <Text variant="micro" color="textSecondary">
            {small}
          </Text>
          <Text variant="heading" numberOfLines={2} style={styles.big}>
            {big}
          </Text>
          <View style={styles.medallion}>
            <Icon size={16} strokeWidth={2.2} color={colors.forest} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: gutter, marginTop: spacing.md },
  tile: { flex: 1, borderRadius: radius.lg - 2, padding: spacing.sm, minHeight: 104 },
  big: { fontSize: 15, lineHeight: 19, paddingRight: 4 },
  medallion: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
