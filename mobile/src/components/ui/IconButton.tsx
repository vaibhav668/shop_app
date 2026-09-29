import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { type ColorName, colors, hitSlop, radius } from '@/theme/tokens';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  color?: ColorName;
  outlined?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  color = 'text',
  outlined = false,
  disabled = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.base, outlined && styles.outlined, pressed && styles.pressed]}
    >
      <Icon size={22} strokeWidth={1.75} color={colors[disabled ? 'textTertiary' : color]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  outlined: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.surfaceMuted },
});
