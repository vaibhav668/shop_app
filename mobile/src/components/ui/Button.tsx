import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type ColorName, colors, radius, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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

const palette: Record<
  Variant,
  { bg: ColorName | null; pressedBg: ColorName; fg: ColorName; border: ColorName | null }
> = {
  primary: { bg: 'action', pressedBg: 'actionPressed', fg: 'onAction', border: null },
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

  return (
    <Pressable
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
        pressed && { backgroundColor: colors[p.pressedBg] },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg]} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={size === 'sm' ? 16 : 18} color={colors[fg]} strokeWidth={2} /> : null}
          <Text variant="bodyStrong" color={fg} style={size === 'sm' && styles.smLabel}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  md: { minHeight: 48, paddingHorizontal: spacing.lg },
  sm: { minHeight: 36, paddingHorizontal: 14 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  smLabel: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
});
