import { House, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { OrderStatus } from '@/api/orders';
import { ProduceArt } from '@/components/art/Produce';
import { ForestFill, Jaali } from '@/components/decor';
import { Text } from '@/components/ui';
import { STATUS_LABEL, STATUS_MESSAGE } from '@/features/orders/orderStatus';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * How far along the route the scooter sits for each status. This is the order's progress, not
 * a live location: the app doesn't track the rider, so it never pretends to.
 */
export const ROUTE_PROGRESS: Record<OrderStatus, number> = {
  AWAITING_PAYMENT: 0,
  PENDING: 0.04,
  CONFIRMED: 0.2,
  PREPARING: 0.36,
  OUT_FOR_DELIVERY: 0.68,
  DELIVERED: 1,
  CANCELLED: 0,
};

const H = 96; // route area height
const RIDER = 40;

// The route is one cubic curve in a 0..1 box: from the shop (left, low) to home (right, high).
const P0 = { x: 0.06, y: 0.78 };
const P1 = { x: 0.38, y: 0.95 };
const P2 = { x: 0.52, y: 0.05 };
const P3 = { x: 0.94, y: 0.28 };

function pointAt(t: number) {
  'worklet';
  const u = 1 - t;
  return {
    x: u * u * u * P0.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t * t * t * P3.x,
    y: u * u * u * P0.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t * t * t * P3.y,
  };
}

function pathFor(w: number) {
  const p = (q: { x: number; y: number }) => `${q.x * w} ${q.y * H}`;
  return `M ${p(P0)} C ${p(P1)}, ${p(P2)}, ${p(P3)}`;
}

export function JourneyCard({
  status,
  placedLabel,
  etaMinutes,
}: {
  status: OrderStatus;
  placedLabel: string;
  etaMinutes?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const target = ROUTE_PROGRESS[status];
  const progress = useSharedValue(0);
  const bob = useSharedValue(0);
  const cancelled = status === 'CANCELLED';
  const moving = status === 'OUT_FOR_DELIVERY';

  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, target, reduceMotion]);

  // Out for delivery: the scooter nudges back and forth so it reads as "on the move".
  useEffect(() => {
    if (!moving || reduceMotion) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(withTiming(0.025, { duration: 900 }), withTiming(-0.02, { duration: 900 })),
      -1,
      true,
    );
  }, [bob, moving, reduceMotion]);

  const riderStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, progress.value + bob.value));
    const pt = pointAt(t);
    return {
      transform: [{ translateX: pt.x * width - RIDER / 2 }, { translateY: pt.y * H - RIDER + 6 }],
    };
  });

  const path = width > 0 ? pathFor(width) : '';

  return (
    <View style={styles.card}>
      <ForestFill borderRadius={radius.xl} />
      <Jaali opacity={0.16} />

      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="micro" color="onForestMuted">
            {placedLabel}
          </Text>
          <Text variant="title" color="onAction" accessibilityRole="header">
            {STATUS_LABEL[status]}
          </Text>
          <Text variant="caption" color="onForestMuted">
            {STATUS_MESSAGE[status]}
          </Text>
        </View>
        {etaMinutes && !cancelled && status !== 'DELIVERED' ? (
          <View style={styles.eta} accessibilityLabel={`Usually about ${etaMinutes} minutes`}>
            <Text variant="title" color="goldBright">
              {etaMinutes}
            </Text>
            <Text variant="micro" color="onForestMuted">
              min
            </Text>
          </View>
        ) : null}
      </View>

      {!cancelled ? (
        <View
          style={styles.route}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {width > 0 ? (
            <>
              <Svg width={width} height={H} style={StyleSheet.absoluteFill}>
                <Path
                  d={path}
                  stroke={colors.glass}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={path}
                  stroke={colors.goldBright}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="2 8"
                />
              </Svg>
              <View style={[styles.pin, { left: P0.x * width - 16, top: P0.y * H - 16 }]}>
                <Store size={16} strokeWidth={2.2} color={colors.forestDeep} />
              </View>
              <View
                style={[styles.pin, styles.home, { left: P3.x * width - 16, top: P3.y * H - 16 }]}
              >
                <House size={16} strokeWidth={2.2} color={colors.forestDeep} />
              </View>
              <Animated.View style={[styles.rider, riderStyle]}>
                <ProduceArt kind="scooter" size={RIDER} />
              </Animated.View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.forest,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  eta: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
  },
  route: { height: H, marginHorizontal: 4 },
  pin: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  home: { backgroundColor: colors.goldBright },
  rider: { position: 'absolute', left: 0, top: 0 },
});
