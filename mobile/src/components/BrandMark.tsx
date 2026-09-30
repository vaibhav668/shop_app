import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Foil } from '@/components/decor';
import { Text } from '@/components/ui';
import { colors, shadow, spacing } from '@/theme/tokens';

/** The gold-foil squircle with a forest basket. */
export function BrandMark({ size = 48 }: { size?: number }) {
  const corner = Math.round(size * 0.32);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { width: size, height: size, borderRadius: corner }]}
    >
      <Foil borderRadius={corner} />
      {/* Wrapped in a View so it paints above the foil on web. */}
      <View>
        <ShoppingBasket size={size * 0.52} strokeWidth={2.2} color={colors.forestDeep} />
      </View>
    </View>
  );
}

/** Mark + "Bada Bazar" + बड़ा बाज़ार. `onDark` for forest backgrounds. */
export function BrandLockup({ size = 48, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <View
      style={styles.lockup}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Bada Bazar"
    >
      <BrandMark size={size} />
      <View>
        <Text variant="title" color={onDark ? 'onAction' : 'text'}>
          Bada Bazar
        </Text>
        <Text
          variant="devanagari"
          color={onDark ? 'goldBright' : 'crust'}
          style={styles.deva}
          aria-hidden
        >
          बड़ा बाज़ार
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    ...shadow.md,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deva: { marginTop: -4 },
});
