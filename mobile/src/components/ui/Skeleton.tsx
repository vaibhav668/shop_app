import { useEffect, useState } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Gradient } from '@/components/decor';
import { colors, radius as radii } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
};

const SHEEN = [colors.border, colors.bg, colors.border] as const;

/** A content-shaped block with a soft light sweeping across it. Still under reduce-motion. */
export function Skeleton({ width = '100%', height, radius = radii.sm }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || boxWidth === 0) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress, reduceMotion, boxWidth]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -boxWidth + progress.value * boxWidth * 2 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }]}
    >
      {reduceMotion || boxWidth === 0 ? null : (
        <Animated.View style={[styles.band, { width: boxWidth }, sweep]}>
          <Gradient colors={SHEEN} angle={0} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
