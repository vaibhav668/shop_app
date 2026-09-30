import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { colors, motion, radius, shadow } from '@/theme/tokens';

export type QuantityStepperProps = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
  size?: 'sm' | 'md';
  /** Used in accessibility labels, e.g. "Increase Amul Milk". */
  itemName?: string;
};

/** Forest squircle with gold − and +; the digit rolls in from above on every change. */
export function QuantityStepper({
  value,
  onIncrement,
  onDecrement,
  max,
  size = 'sm',
  itemName,
}: QuantityStepperProps) {
  const atMax = max !== undefined && value >= max;
  const height = size === 'sm' ? 34 : 44;
  const side = size === 'sm' ? 30 : 40;
  const suffix = itemName ? ` ${itemName}` : ' quantity';

  return (
    <Animated.View entering={ZoomIn.duration(motion.base)} style={[styles.container, { height }]}>
      <Pressable
        onPress={onDecrement}
        accessibilityRole="button"
        accessibilityLabel={`Decrease${suffix}`}
        style={({ pressed }) => [styles.side, { width: side }, pressed && styles.pressed]}
      >
        <Minus size={16} strokeWidth={2.6} color={colors.goldBright} />
      </Pressable>
      <View style={styles.valueBox}>
        <Animated.View key={value} entering={FadeInDown.duration(motion.base)}>
          <Text variant="price" color="onAction" tabular accessibilityLabel={`${value}`}>
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
        style={({ pressed }) => [
          styles.side,
          { width: side },
          pressed && styles.pressed,
          atMax && styles.atMax,
        ]}
      >
        <Plus size={16} strokeWidth={2.6} color={colors.goldBright} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...shadow.md,
    shadowOpacity: 0.25,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md - 2,
    backgroundColor: colors.forest,
  },
  side: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 2 },
  pressed: { backgroundColor: colors.forestDeep },
  atMax: { opacity: 0.4 },
  valueBox: { minWidth: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
