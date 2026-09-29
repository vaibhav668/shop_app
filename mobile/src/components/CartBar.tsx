import { router } from 'expo-router';
import { ChevronRight, ShoppingBasket } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Money, Text } from '@/components/ui';
import { useCart } from '@/features/cart/hooks';
import { colors, floatShadow, gutter, motion, radius, spacing } from '@/theme/tokens';

/** "3 items · ₹245  View cart ›" — visible whenever the cart has something in it. */
export function CartBar({ safeBottom = false }: { safeBottom?: boolean }) {
  const { data: cart } = useCart();
  const insets = useSafeAreaInsets();
  const count = cart?.item_count ?? 0;
  const scale = useSharedValue(1);

  // A small bounce when the count changes confirms the tap landed.
  useEffect(() => {
    if (count > 0) {
      scale.value = withSequence(
        withTiming(1.04, { duration: motion.fast }),
        withTiming(1, { duration: motion.fast }),
      );
    }
  }, [count, scale]);

  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!cart || count === 0) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(220)}
      exiting={SlideOutDown.duration(180)}
      style={[styles.wrap, safeBottom && { paddingBottom: spacing.xs + insets.bottom }]}
    >
      <Animated.View style={bounce}>
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${count} ${count === 1 ? 'item' : 'items'}`}
          style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
        >
          <View style={styles.left}>
            <ShoppingBasket size={20} strokeWidth={2} color={colors.onAction} />
            <View>
              <Text variant="micro" color="onAction">
                {count} {count === 1 ? 'ITEM' : 'ITEMS'}
              </Text>
              <Money paise={cart.total_paise} variant="bodyStrong" color="onAction" />
            </View>
          </View>
          <View style={styles.right}>
            <Text variant="bodyStrong" color="onAction">
              View cart
            </Text>
            <ChevronRight size={18} strokeWidth={2.5} color={colors.onAction} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  bar: {
    ...floatShadow,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.action,
  },
  pressed: { backgroundColor: colors.actionPressed },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  right: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
