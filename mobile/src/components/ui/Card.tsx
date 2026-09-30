import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme/tokens';

export type CardProps = {
  children: ReactNode;
  /** A soft tint instead of white, e.g. colors.tintButter. */
  tint?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** White card with a soft forest-tinted shadow instead of an outline. */
export function Card({ children, tint, padded = true, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        tint ? { backgroundColor: tint, shadowOpacity: 0 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg },
  padded: { padding: spacing.md },
});
