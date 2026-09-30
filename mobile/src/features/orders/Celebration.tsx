import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Path } from 'react-native-svg';

import { SealArt } from '@/components/art/Produce';
import { colors } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 60;

/** The gold seal pops in and rotates into place, then the check draws itself. */
export function OrderSeal({ size = 140 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withSpring(1, { damping: 11, stiffness: 180, mass: 0.7 });
    draw.value = withDelay(420, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
  }, [pop, draw, reduceMotion]);

  const sealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: [{ scale: 0.3 + 0.7 * pop.value }, { rotate: `${-40 * (1 - pop.value)}deg` }],
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - draw.value),
  }));

  return (
    <Animated.View style={sealStyle} accessibilityElementsHidden>
      <SealArt size={size}>
        <AnimatedPath
          d="M34 51l11 11 22-24"
          fill="none"
          stroke={colors.goldBright}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          animatedProps={checkProps}
        />
      </SealArt>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [
  colors.goldBright,
  colors.brand,
  colors.gold,
  colors.leaf,
  colors.danger,
  colors.forest,
];

type Piece = {
  dx: number;
  dy: number;
  rotate: number;
  color: string;
  delay: number;
  wide: boolean;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 90 + Math.random() * 110;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance + 120,
      rotate: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: 340 + Math.random() * 160,
      wide: i % 3 === 0,
    };
  });
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 1200, easing: Easing.bezier(0.1, 0.7, 0.3, 1) }),
    );
  }, [t, piece.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: piece.dx * t.value },
      { translateY: piece.dy * t.value },
      { rotate: `${piece.rotate * t.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        piece.wide && styles.pieceWide,
        { backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

/** One burst of confetti from the seal. Nothing under reduce-motion. */
export function Confetti({ top }: { top: number }) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo(() => makePieces(30), []);
  if (reduceMotion) return null;
  return (
    <View style={[styles.origin, { top }]} pointerEvents="none" accessibilityElementsHidden>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} />
      ))}
    </View>
  );
}

/** Counts up to `value` over about half a second (instant under reduce-motion). */
export function useCountUp(value: number | undefined, delay = 500): number | undefined {
  const reduceMotion = useReducedMotion();
  // Frames counted for one particular value; a new value starts again from frame 0.
  const [tick, setTick] = useState<{ value: number | undefined; frame: number }>({
    value,
    frame: 0,
  });
  const STEP = 4;
  const SPAN = 48;

  useEffect(() => {
    if (value === undefined || reduceMotion) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        setTick((t) => {
          const frame = t.value === value ? t.frame + 1 : 1;
          if (frame * STEP >= SPAN) clearInterval(timer);
          return { value, frame };
        });
      }, 18);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [value, delay, reduceMotion]);

  if (value === undefined || reduceMotion) return value;
  const frame = tick.value === value ? tick.frame : 0;
  return Math.min(value, Math.max(0, value - SPAN) + frame * STEP);
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', width: 0, height: 0 },
  piece: { position: 'absolute', width: 7, height: 12, borderRadius: 2 },
  pieceWide: { width: 10, height: 6 },
});
