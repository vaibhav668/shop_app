import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { colors, motion, radius } from '@/theme/tokens';

export type QuantityStepperProps = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
  size?: 'sm' | 'md';
  /** Used in accessibility labels, e.g. "Increase Amul Milk". */
  itemName?: string;
};

export function QuantityStepper({
  value,
  onIncrement,
  onDecrement,
  max,
  size = 'sm',
  itemName,
}: QuantityStepperProps) {
  const atMax = max !== undefined && value >= max;
  const height = size === 'sm' ? 32 : 40;
  const suffix = itemName ? ` ${itemName}` : ' quantity';

  return (
    <View style={[styles.container, { height }]}>
      <Pressable
        onPress={onDecrement}
        accessibilityRole="button"
        accessibilityLabel={`Decrease${suffix}`}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
      >
        <Minus size={16} strokeWidth={2.5} color={colors.onAction} />
      </Pressable>
      <View style={styles.valueBox}>
        <Animated.View key={value} entering={FadeInDown.duration(motion.fast)}>
          <Text variant="bodyStrong" color="onAction" tabular accessibilityLabel={`${value}`}>
            {value}
          </Text>
        </Animated.View>
      </View>
      <Pressable
        onPress={onIncrement}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel={`Increase${suffix}`}
        accessibilityState={{ disabled: atMax }}
        style={({ pressed }) => [styles.side, pressed && styles.pressed, atMax && styles.atMax]}
      >
        <Plus size={16} strokeWidth={2.5} color={colors.onAction} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.full,
    backgroundColor: colors.action,
    overflow: 'hidden',
  },
  side: { width: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.actionPressed },
  atMax: { opacity: 0.45 },
  valueBox: { minWidth: 24, alignItems: 'center', justifyContent: 'center' },
});
