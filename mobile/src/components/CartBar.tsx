import { router } from 'expo-router';
import { ChevronRight, ShoppingBasket } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Gradient } from '@/components/decor';
import { ProductImage } from '@/components/product/ProductImage';
import { Money, PressableScale, Text } from '@/components/ui';
import { useFlyToCart } from '@/features/cart/FlyToCart';
import { useCart } from '@/features/cart/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, shadow, spacing, springs, tintFor } from '@/theme/tokens';

const SHEEN = ['rgba(251, 191, 36, 0)', 'rgba(251, 191, 36, 0.22)', 'rgba(251, 191, 36, 0)'];

/**
 * The forest cart pill: up to three product thumbnails, the count and total, and a gold
 * "View cart". It bounces when the count changes and a gold sheen passes over it now and then.
 */
export function CartBar({ safeBottom = false }: { safeBottom?: boolean }) {
  const { data: cart } = useCart();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const count = cart?.item_count ?? 0;
  const scale = useSharedValue(1);
  const sheen = useSharedValue(0);
  const [width, setWidth] = useState(0);
  const pillRef = useRef<View>(null);
  const targetId = useId();
  const { registerTarget } = useFlyToCart();
  const visible = count > 0;

  // Products added anywhere fly into this pill.
  useEffect(() => {
    if (!visible) return;
    registerTarget(targetId, pillRef);
    return () => registerTarget(targetId, null);
  }, [visible, registerTarget, targetId]);

  // A bounce when the count changes confirms the tap landed.
  useEffect(() => {
    if (count > 0 && !reduceMotion) {
      scale.value = withSequence(withSpring(1.05, springs.bouncy), withSpring(1, springs.press));
    }
  }, [count, scale, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    sheen.value = withRepeat(
      withDelay(2200, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) })),
      -1,
      false,
    );
  }, [sheen, reduceMotion, width]);

  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + sheen.value * width * 2 }],
  }));

  if (!cart || count === 0) return null;

  const thumbs = cart.lines.slice(0, 3);
  const freeLeft = cart.free_delivery_remaining_paise;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(180)}
      style={[styles.wrap, safeBottom && { paddingBottom: spacing.xs + insets.bottom }]}
    >
      <Animated.View style={bounce} ref={pillRef} collapsable={false}>
        <PressableScale
          onPress={() => router.push('/cart')}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${count} ${count === 1 ? 'item' : 'items'}, ${formatPaise(cart.total_paise)}`}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
        >
          {width > 0 && !reduceMotion ? (
            <Animated.View style={[styles.sheen, { width }, sweep]}>
              <Gradient colors={SHEEN} angle={0} />
            </Animated.View>
          ) : null}

          <View style={styles.thumbs} aria-hidden>
            {thumbs.length > 0 ? (
              thumbs.map((line, i) => (
                <View
                  key={line.product.id}
                  style={[
                    styles.thumb,
                    { backgroundColor: tintFor(line.product.id), zIndex: 3 - i },
                    i > 0 && styles.overlap,
                  ]}
                >
                  <ProductImage
                    uri={line.product.image_url}
                    name={line.product.name}
                    iconSize={16}
                  />
                </View>
              ))
            ) : (
              <View style={styles.thumb}>
                <ShoppingBasket size={16} strokeWidth={2} color={colors.forest} />
              </View>
            )}
          </View>

          <View style={styles.meta} aria-hidden>
            <Text variant="button" color="onAction">
              {count} {count === 1 ? 'item' : 'items'} ·{' '}
              <Money paise={cart.total_paise} variant="button" color="onAction" />
            </Text>
            <Text variant="micro" color="onForestMuted" numberOfLines={1}>
              {freeLeft > 0
                ? `${formatPaise(freeLeft)} more for free delivery`
                : 'Free delivery unlocked'}
            </Text>
          </View>

          <View style={styles.go} aria-hidden>
            <Text variant="button" color="goldBright">
              View cart
            </Text>
            <ChevronRight size={18} strokeWidth={2.6} color={colors.goldBright} />
          </View>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter - 4, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  bar: {
    ...shadow.float,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.forest,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.forestDeep },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  thumbs: { flexDirection: 'row' },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
  },
  overlap: { marginLeft: -12 },
  meta: { flex: 1, minWidth: 0 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
