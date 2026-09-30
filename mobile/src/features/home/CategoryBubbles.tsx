import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Category } from '@/api/catalog';
import { artForName, ProduceArt } from '@/components/art/Produce';
import { PressableScale, Text } from '@/components/ui';
import { colors, gutter, spacing, tintFor } from '@/theme/tokens';

const SIZE = 64;

/** Round, tinted category shortcuts that scroll sideways, ending in "All". */
export function CategoryBubbles({ categories }: { categories: Category[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {categories.slice(0, 10).map((c) => (
        <PressableScale
          key={c.id}
          onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={c.name}
          style={styles.bubble}
        >
          <View style={[styles.circle, { backgroundColor: tintFor(c.id) }]}>
            {c.image_url ? (
              <Image
                source={c.image_url}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : artForName(c.name) ? (
              <ProduceArt kind={artForName(c.name)!} size={44} />
            ) : (
              <LayoutGrid size={24} strokeWidth={1.8} color={colors.forest} />
            )}
          </View>
          <Text variant="micro" align="center" numberOfLines={2} aria-hidden>
            {c.name}
          </Text>
        </PressableScale>
      ))}
      <PressableScale
        onPress={() => router.push('/categories')}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="All categories"
        style={styles.bubble}
      >
        <View style={[styles.circle, styles.all]}>
          <LayoutGrid size={24} strokeWidth={2} color={colors.goldBright} />
        </View>
        <Text variant="micro" align="center" aria-hidden>
          All
        </Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: gutter, gap: spacing.sm, paddingTop: spacing.lg },
  bubble: { width: SIZE + 6, alignItems: 'center', gap: 6 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  image: { width: '100%', height: '100%' },
  all: { backgroundColor: colors.forest },
});
