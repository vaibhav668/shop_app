import { Image } from 'expo-image';
import { LayoutGrid } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/catalog';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

function CategoryTileBase({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.imageWell}>
        {category.image_url ? (
          <Image
            source={category.image_url}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <LayoutGrid size={28} strokeWidth={1.5} color={colors.textTertiary} />
        )}
      </View>
      <Text variant="label" align="center" numberOfLines={2} style={styles.label}>
        {category.name}
      </Text>
    </Pressable>
  );
}

export const CategoryTile = memo(CategoryTileBase);

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  imageWell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  label: { fontSize: 13, lineHeight: 18, minHeight: 36 },
});
