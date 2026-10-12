import { Image } from 'expo-image';
import { LayoutGrid } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/catalog';
import { artForName, ProduceArt } from '@/components/art/Produce';
import { Text } from '@/components/ui';
import { colors, radius, spacing, tintFor } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export const AISLE_RAIL_WIDTH = 84;
const ITEM_HEIGHT = 92;

function AisleIcon({ category }: { category: Category }) {
  if (category.image_url) {
    return (
      <Image
        source={category.image_url}
        style={styles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    );
  }
  const art = artForName(category.name);
  return art ? (
    <ProduceArt kind={art} size={40} />
  ) : (
    <LayoutGrid size={22} strokeWidth={1.8} color={colors.forest} />
  );
}

/**
 * Every aisle down the left side, with its art. The current one is outlined in forest with an
 * edge marker; tapping another switches the product grid beside it.
 */
export function AisleRail({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: Category[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const scroller = useRef<ScrollView>(null);
  const index = categories.findIndex((c) => c.slug === activeSlug);

  // Keep the current aisle in view (it may be far down the list).
  useEffect(() => {
    if (index > 2) {
      scroller.current?.scrollTo({ y: (index - 2) * ITEM_HEIGHT, animated: true });
    }
  }, [index]);

  return (
    <ScrollView
      ref={scroller}
      style={styles.rail}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityRole="tablist"
    >
      {categories.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.slug)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={c.name}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            {active ? <View style={styles.edge} /> : null}
            <View
              style={[
                styles.tile,
                { backgroundColor: active ? colors.tintMint : tintFor(c.id) },
                active && styles.tileActive,
              ]}
            >
              <AisleIcon category={c} />
            </View>
            <Text
              variant="micro"
              color={active ? 'text' : 'textSecondary'}
              align="center"
              numberOfLines={2}
              style={active && styles.labelActive}
              aria-hidden
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: AISLE_RAIL_WIDTH,
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  content: { paddingVertical: spacing.xs, paddingBottom: 140 },
  item: {
    minHeight: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.7 },
  edge: {
    position: 'absolute',
    right: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.forest,
  },
  tile: {
    width: 54,
    height: 54,
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileActive: { borderWidth: 1.5, borderColor: colors.forest },
  image: { width: '78%', height: '78%' },
  labelActive: { fontFamily: fonts.displayHeavy },
});
