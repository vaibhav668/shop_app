import { Heart } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useFavouriteIds, useToggleFavourite } from '@/features/cart/hooks';
import { colors, hitSlop, radius } from '@/theme/tokens';

export function FavouriteButton({ productId, name }: { productId: string; name: string }) {
  const { data: ids } = useFavouriteIds();
  const toggle = useToggleFavourite();
  const on = ids?.includes(productId) ?? false;

  return (
    <Pressable
      onPress={() => toggle.mutate({ productId, on: !on })}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Heart
        size={22}
        strokeWidth={1.75}
        color={on ? colors.brand : colors.text}
        fill={on ? colors.brand : 'transparent'}
      />
    </Pressable>
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
  pressed: { backgroundColor: colors.surfaceMuted },
});
