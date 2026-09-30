import { type ReactNode, useState } from 'react';
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

/**
 * A Pressable that sinks a little under the finger and springs back: every tap feels physical.
 * The pressed state is tracked here and the style resolved to a plain value, because animated
 * components ignore function styles (they rendered unstyled on web).
 */
export function PressableScale({
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const state = { pressed };

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        setPressed(true);
        if (!reduceMotion) scale.set(withSpring(scaleTo, springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, springs.press));
        onPressOut?.(e);
      }}
      style={[typeof style === 'function' ? style(state) : style, animated]}
      {...rest}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
