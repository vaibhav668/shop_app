import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { springs } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type State = { pressed: boolean };

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode | ((state: State) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: State) => StyleProp<ViewStyle>);
  /** How far it shrinks under the finger. */
  scaleTo?: number;
};

/** A Pressable that sinks a little under the finger and springs back: every tap feels physical. */
export function PressableScale({
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withSpring(scaleTo, springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, springs.press));
        onPressOut?.(e);
      }}
      style={(state: State) => [typeof style === 'function' ? style(state) : style, animated]}
      {...rest}
    />
  );
}
