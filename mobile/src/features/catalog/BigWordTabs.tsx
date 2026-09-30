import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import type { Category } from '@/api/catalog';
import { colors, gutter, spacing } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

const layout = LinearTransition.springify().damping(20).stiffness(220);

/**
 * Sibling categories as words: the current one is big and ink, the rest small and grey.
 * Tapping a word switches category in place.
 */
export function BigWordTabs({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: Category[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const placed = useRef(false);

  // Keep the active word in view when it changes.
  useEffect(() => {
    const x = offsets.current.get(activeSlug);
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - gutter), animated: true });
  }, [activeSlug]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {categories.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.slug)}
            onLayout={(e) => {
              const x = e.nativeEvent.layout.x;
              offsets.current.set(c.slug, x);
              // First layout: bring the current category into view (it may be far right).
              if (active && !placed.current) {
                placed.current = true;
                scroller.current?.scrollTo({ x: Math.max(0, x - gutter), animated: false });
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={c.name}
            hitSlop={8}
          >
            <Animated.Text
              layout={layout}
              maxFontSizeMultiplier={1.2}
              style={[styles.word, active ? styles.active : styles.idle]}
            >
              {c.name}
            </Animated.Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: gutter,
    gap: spacing.md,
    alignItems: 'baseline',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  word: { fontFamily: fonts.displayHeavy, letterSpacing: -0.6 },
  active: { fontSize: 30, lineHeight: 38, color: colors.text },
  idle: { fontSize: 16, lineHeight: 38, color: colors.textTertiary },
});
