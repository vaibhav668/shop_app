import { Image } from 'expo-image';
import { ChevronRight, LayoutGrid } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Category } from '@/api/catalog';
import { artForName, ProduceArt } from '@/components/art/Produce';
import { PressableScale, Text } from '@/components/ui';
import { colors, radius, shadow, spacing, tintFor } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/** White card with a tinted image well; it lifts slightly under the finger. */
function CategoryTileBase({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      style={styles.tile}
    >
      <View style={[styles.imageWell, { backgroundColor: tintFor(category.id) }]}>
        {category.image_url ? (
          <Image
            source={category.image_url}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : artForName(category.name) ? (
          <ProduceArt kind={artForName(category.name)!} size={64} />
        ) : (
          <LayoutGrid size={28} strokeWidth={1.8} color={colors.forest} />
        )}
      </View>
      <Text variant="label" numberOfLines={2} style={styles.label} aria-hidden>
        {category.name}
      </Text>
      <View style={styles.shop} aria-hidden>
        <Text variant="tag" color="forestMid">
          Shop
        </Text>
        <ChevronRight size={12} strokeWidth={2.6} color={colors.forestMid} />
      </View>
    </PressableScale>
  );
}

export const CategoryTile = memo(CategoryTileBase);

const styles = StyleSheet.create({
  tile: {
    ...shadow.sm,
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 6,
  },
  imageWell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg - 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  label: {
    fontFamily: fonts.displayBold,
    fontSize: 13,
    lineHeight: 17,
    minHeight: 34,
    marginTop: 6,
    marginHorizontal: 4,
  },
  shop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginHorizontal: 4,
    marginBottom: 4,
  },
});
