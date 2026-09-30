import { Heart } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui';
import { useFavouriteIds, useToggleFavourite } from '@/features/cart/hooks';
import { colors, hitSlop, radius, shadow } from '@/theme/tokens';

export function FavouriteButton({
  productId,
  name,
  floating = false,
}: {
  productId: string;
  name: string;
  /** A raised white circle, for sitting on top of a product picture. */
  floating?: boolean;
}) {
  const { data: ids } = useFavouriteIds();
  const toggle = useToggleFavourite();
  const on = ids?.includes(productId) ?? false;

  return (
    <PressableScale
      onPress={() => toggle.mutate({ productId, on: !on })}
      hitSlop={hitSlop}
      scaleTo={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      style={({ pressed }) => [
        styles.button,
        floating && styles.floating,
        pressed && !floating && styles.pressed,
      ]}
    >
      {/* Re-keyed so the heart pops each time it's switched on. */}
      <Animated.View key={on ? 'on' : 'off'} entering={on ? ZoomIn.springify() : undefined}>
        <Heart
          size={22}
          strokeWidth={1.9}
          color={on ? colors.danger : colors.text}
          fill={on ? colors.danger : 'transparent'}
        />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  floating: { ...shadow.sm, backgroundColor: colors.surface, borderRadius: 22 },
  pressed: { backgroundColor: colors.surfaceMuted },
});
