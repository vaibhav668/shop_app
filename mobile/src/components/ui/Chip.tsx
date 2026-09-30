import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  testID?: string;
};

/** A filter chip. The selected one turns solid ink, which reads at a glance on any tint. */
export function Chip({ label, selected = false, onPress, icon: Icon, testID }: ChipProps) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
    >
      {Icon ? (
        <Icon size={14} strokeWidth={2.2} color={selected ? colors.goldBright : colors.text} />
      ) : null}
      <Text variant="label" color={selected ? 'onAction' : 'text'} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginRight: spacing.xs,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { fontSize: 13 },
});
