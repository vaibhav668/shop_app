import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';
import { textVariants } from '@/theme/typography';

export type InputProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function Input({ label, error, hint, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.forest : colors.border;

  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="text">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        // Android defaults these to the system accent; keep them on-brand.
        selectionColor={colors.brand}
        cursorColor={colors.brand}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          { borderColor, borderWidth: focused || error ? 2 : 1 },
          { paddingHorizontal: focused || error ? 13 : 14 },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  input: {
    ...textVariants.body,
    outlineWidth: 0,
    outlineColor: 'transparent',
    color: colors.text,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
});
