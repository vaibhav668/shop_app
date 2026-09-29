import { StyleSheet } from 'react-native';

import { Text, type TextProps } from '@/components/ui/Text';
import { formatPaise } from '@/lib/money';

export type MoneyProps = Omit<TextProps, 'children'> & {
  paise: number;
  /** Struck-through, for MRP next to a selling price. */
  strike?: boolean;
};

export function Money({ paise, strike = false, style, ...rest }: MoneyProps) {
  return (
    <Text tabular style={[strike && styles.strike, style]} {...rest}>
      {formatPaise(paise)}
    </Text>
  );
}

const styles = StyleSheet.create({
  strike: { textDecorationLine: 'line-through' },
});
