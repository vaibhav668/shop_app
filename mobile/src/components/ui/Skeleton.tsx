import { useEffect } from 'react';
import { type DimensionValue, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius as radii } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
};

/** A calm opacity pulse on a content-shaped block. No shimmer gradient by design. */
export function Skeleton({ width = '100%', height, radius = radii.sm }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.6, { duration: 800 }), -1, true);
  }, [opacity, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: radius }, animated]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceMuted },
});
