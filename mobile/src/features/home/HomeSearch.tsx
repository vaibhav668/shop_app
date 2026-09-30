import { router } from 'expo-router';
import { ArrowRight, Search, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  useReducedMotion,
} from 'react-native-reanimated';

import { ForestFill } from '@/components/decor';
import { PressableScale, Text } from '@/components/ui';
import { colors, gutter, radius, shadow, spacing } from '@/theme/tokens';

const WORDS = ['milk', 'atta', 'paneer', 'dal', 'tomatoes'];

/** "Search "milk"" with the word changing every few seconds, so the bar hints at what's here. */
function RotatingHint() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2600);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <View style={styles.hint}>
      <Text variant="body" color="textTertiary">
        Search{' '}
      </Text>
      <Animated.View
        key={index}
        entering={reduceMotion ? undefined : FadeInDown.duration(260)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(200)}
      >
        <Text variant="body" color="textSecondary">
          &ldquo;{WORDS[index]}&rdquo;
        </Text>
      </Animated.View>
    </View>
  );
}

/** The search pill that overlaps the bottom of the forest header. */
export function HomeSearch() {
  return (
    <PressableScale
      onPress={() => router.push('/search')}
      scaleTo={0.98}
      accessibilityRole="search"
      accessibilityLabel="Search for groceries"
      style={styles.bar}
    >
      <Search size={20} strokeWidth={2} color={colors.forest} />
      <RotatingHint />
      <View style={styles.go}>
        <ArrowRight size={18} strokeWidth={2.4} color={colors.goldBright} />
      </View>
    </PressableScale>
  );
}

/** A slim forest bar that slides in once the big header has scrolled away. */
export function MiniHeader({ etaMinutes }: { etaMinutes: number | undefined }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      style={[styles.mini, { paddingTop: insets.top + 6 }]}
    >
      <ForestFill />
      <PressableScale
        onPress={() => router.push('/search')}
        scaleTo={0.98}
        accessibilityRole="search"
        accessibilityLabel="Search for groceries"
        style={styles.miniSearch}
      >
        <Search size={16} strokeWidth={2} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          Search for milk, atta, dal…
        </Text>
      </PressableScale>
      {etaMinutes ? (
        <View style={styles.miniEta}>
          <Zap size={12} strokeWidth={2.4} color={colors.forestDeep} fill={colors.forestDeep} />
          <Text variant="tag" color="forestDeep">
            {etaMinutes} min
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...shadow.md,
    marginTop: -26,
    marginHorizontal: gutter,
    height: 52,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
  },
  hint: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 24 },
  go: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 2,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mini: {
    ...shadow.float,
    shadowOpacity: 0.2,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.forest,
    overflow: 'hidden',
  },
  miniSearch: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  miniEta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.goldBright,
  },
});
