import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { type ColorName, colors, hitSlop, radius, shadow } from '@/theme/tokens';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  color?: ColorName;
  /** A raised white squircle, for buttons that sit on tints or photos. */
  outlined?: boolean;
  /** Frosted glass, for buttons on forest headers. */
  glass?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  color,
  outlined = false,
  glass = false,
  disabled = false,
  testID,
}: IconButtonProps) {
  const tint: ColorName = disabled ? 'textTertiary' : (color ?? (glass ? 'onAction' : 'text'));
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        outlined && styles.outlined,
        glass && styles.glass,
        pressed && !glass && styles.pressed,
      ]}
    >
      <Icon size={21} strokeWidth={1.9} color={colors[tint]} />
    </PressableScale>
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
  outlined: { ...shadow.sm, backgroundColor: colors.surface },
  glass: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glass },
  pressed: { backgroundColor: colors.surfaceMuted },
});
