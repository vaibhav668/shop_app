import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasketArt, ProduceArt, type ProduceKind } from '@/components/art/Produce';
import { BrandMark } from '@/components/BrandMark';
import { PressableScale, Text } from '@/components/ui';
import { markIntroSeen } from '@/features/intro/introSeen';
import { colors, gutter, radius, shadow, spacing } from '@/theme/tokens';

type Slide = {
  key: string;
  title: [string, string, string]; // before, highlighted, after
  body: string;
  hero: 'basket' | ProduceKind;
  floats: [ProduceKind, ProduceKind, ProduceKind];
  tint: string;
};

const SLIDES: Slide[] = [
  {
    key: 'fresh',
    title: ['Fresh from your ', 'neighbourhood', ' shop'],
    body: 'Packed by the people you already buy from.',
    hero: 'basket',
    floats: ['tomato', 'banana', 'greens'],
    tint: colors.tintSage,
  },
  {
    key: 'pay',
    title: ['Pay ', 'cash or UPI', ' at your door'],
    body: 'No card needed. You pay when the bag is in your hands.',
    hero: 'coin',
    floats: ['coin', 'milk', 'orange'],
    tint: colors.tintButter,
  },
  {
    key: 'track',
    title: ['Watch it ', 'ride to you', ''],
    body: 'Every step, from packing to your door, live on your phone.',
    hero: 'scooter',
    floats: ['milk', 'bread', 'carrot'],
    tint: colors.tintMint,
  },
];

/** A small piece of produce bobbing on its own rhythm. */
function Floater({
  kind,
  delay,
  style,
}: {
  kind: ProduceKind;
  delay: number;
  style: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [t, delay, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -11 * t.value }, { rotate: `${-5 + 10 * t.value}deg` }],
  }));
  return (
    <Animated.View style={[styles.floater, style, animated]}>
      <ProduceArt kind={kind} size={46} />
    </Animated.View>
  );
}

function SlideView({ slide, width }: { slide: Slide; width: number }) {
  return (
    <View style={[styles.slide, { width, backgroundColor: slide.tint }]}>
      <View style={styles.art}>
        <View style={styles.halo} />
        {slide.hero === 'basket' ? (
          <BasketArt size={196} />
        ) : (
          <ProduceArt kind={slide.hero} size={160} />
        )}
        <Floater kind={slide.floats[0]} delay={0} style={styles.f1} />
        <Floater kind={slide.floats[1]} delay={700} style={styles.f2} />
        <Floater kind={slide.floats[2]} delay={1400} style={styles.f3} />
      </View>
      <View style={styles.copy}>
        <Text variant="hero" accessibilityRole="header">
          {slide.title[0]}
          <Text variant="hero" style={styles.mark}>
            {slide.title[1]}
          </Text>
          {slide.title[2]}
        </Text>
        <Text variant="body" color="textSecondary">
          {slide.body}
        </Text>
      </View>
    </View>
  );
}

/** Three slides on first launch only; "Get started" (or Skip) goes to sign-in. */
export default function IntroScreen() {
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (last) {
      void markIntroSeen();
      return;
    }
    list.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: SLIDES[index].tint }]}>
      <StatusBar style="dark" />
      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onSettle}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => <SlideView slide={item} width={width} />}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top}>
          <View style={styles.brand}>
            <BrandMark size={30} />
            <Text variant="heading">Bada Bazar</Text>
          </View>
          {!last ? (
            <Pressable onPress={() => void markIntroSeen()} accessibilityRole="button" hitSlop={12}>
              <Text variant="label" color="action">
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <View style={styles.pager} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <PressableScale
            onPress={next}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Get started' : 'Next'}
            style={[styles.next, last && styles.nextWide]}
          >
            {last ? (
              <Text variant="button" color="onAction">
                Get started
              </Text>
            ) : null}
            <ArrowRight size={22} strokeWidth={2.4} color={colors.goldBright} />
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slide: { flex: 1, paddingTop: 110 },
  art: { height: 280, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.surface,
    opacity: 0.75,
  },
  floater: { position: 'absolute' },
  f1: { left: 28, top: 18 },
  f2: { right: 26, top: 44 },
  f3: { right: 60, bottom: 8 },
  copy: { paddingHorizontal: gutter + 4, gap: spacing.sm, marginTop: spacing.lg },
  mark: { backgroundColor: colors.goldPale },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    paddingHorizontal: gutter + 4,
    paddingBottom: spacing.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pager: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { width: 26, backgroundColor: colors.forest },
  next: {
    ...shadow.float,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  nextWide: { width: 176 },
});
