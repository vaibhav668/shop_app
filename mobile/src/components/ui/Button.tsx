import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { type ColorName, colors, radius, shadow, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

type Look = {
  bg: ColorName | null;
  pressedBg: ColorName;
  fg: ColorName;
  iconColor?: ColorName;
  border: ColorName | null;
  raised?: boolean;
};

const palette: Record<Variant, Look> = {
  // Forest with a gold icon: the one "do it" button on a screen.
  primary: {
    bg: 'forest',
    pressedBg: 'forestDeep',
    fg: 'onAction',
    iconColor: 'goldBright',
    border: null,
    raised: true,
  },
  // Gold, for buttons on forest surfaces (headers, hero cards).
  gold: { bg: 'goldBright', pressedBg: 'gold', fg: 'forestDeep', border: null, raised: true },
  secondary: { bg: 'surface', pressedBg: 'surfaceMuted', fg: 'text', border: 'border' },
  ghost: { bg: null, pressedBg: 'brandTint', fg: 'action', border: null },
  danger: { bg: 'surface', pressedBg: 'dangerTint', fg: 'danger', border: 'border' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const fg: ColorName = disabled ? 'textTertiary' : p.fg;
  const iconColor: ColorName = disabled ? 'textTertiary' : (p.iconColor ?? p.fg);

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        fullWidth && styles.fullWidth,
        p.border && { borderWidth: 1, borderColor: colors[p.border] },
        { backgroundColor: p.bg ? colors[p.bg] : 'transparent' },
        p.raised && !disabled && styles.raised,
        pressed && { backgroundColor: colors[p.pressedBg] },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg]} />
      ) : (
        <View style={styles.content}>
          {Icon ? (
            <Icon size={size === 'sm' ? 16 : 18} color={colors[iconColor]} strokeWidth={2.2} />
          ) : null}
          <Text variant="button" color={fg} style={size === 'sm' && styles.smLabel}>
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md + 2,
    alignSelf: 'flex-start',
  },
  md: { minHeight: 52, paddingHorizontal: spacing.xl },
  sm: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.md - 2 },
  fullWidth: { alignSelf: 'stretch' },
  raised: { ...shadow.md, shadowOpacity: 0.22 },
  disabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  smLabel: { fontSize: 13, lineHeight: 18 },
});
