import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { type ColorName, colors } from '@/theme/tokens';
import { type TextVariant, textVariants } from '@/theme/typography';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: ColorName;
  /** Fixed-width digits, for prices and counts. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color = 'text',
  tabular = false,
  align,
  style,
  maxFontSizeMultiplier = 1.3,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        textVariants[variant],
        { color: colors[color] },
        tabular && styles.tabular,
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
});
