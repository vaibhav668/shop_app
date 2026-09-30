import { Image } from 'expo-image';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { Banner } from '@/api/catalog';
import { ForestFill, Gradient, Jaali } from '@/components/decor';
import { PressableScale, Text } from '@/components/ui';
import { type ColorName, colors, gutter, radius, spacing } from '@/theme/tokens';

const GAP = spacing.sm;
const AUTO_ADVANCE_MS = 4000;

type Look = {
  fill: 'forest' | readonly string[];
  title: ColorName;
  body: ColorName;
  ctaBg: ColorName;
  ctaFg: ColorName;
};

// Banners take turns between three looks, so the row never feels repetitive.
const LOOKS: Look[] = [
  {
    fill: [colors.goldSoft, colors.tintPeach],
    title: 'text',
    body: 'goldDeep',
    ctaBg: 'forestDeep',
    ctaFg: 'goldBright',
  },
  {
    fill: 'forest',
    title: 'onAction',
    body: 'onForestMuted',
    ctaBg: 'goldBright',
    ctaFg: 'forestDeep',
  },
  {
    fill: [colors.tintMint, colors.tintLime],
    title: 'text',
    body: 'forest',
    ctaBg: 'forest',
    ctaFg: 'onAction',
  },
];

/** Promotions set by the shop. Glides to the next one every few seconds; pauses while touched. */
export function BannerCarousel({
  banners,
  onOpen,
}: {
  banners: Banner[];
  onOpen: (banner: Banner) => void;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const cardWidth = width - gutter * 2;
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const list = useRef<FlatList<Banner>>(null);

  useEffect(() => {
    if (reduceMotion || touching || banners.length < 2) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % banners.length;
      list.current?.scrollToOffset({ offset: next * (cardWidth + GAP), animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, touching, reduceMotion, banners.length, cardWidth]);

  if (banners.length === 0) return null;

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)));
    setTouching(false);
  };

  return (
    <View>
      <FlatList
        ref={list}
        horizontal
        data={banners}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        onScrollBeginDrag={() => setTouching(true)}
        onMomentumScrollEnd={onSettle}
        renderItem={({ item, index: i }) => {
          const look = LOOKS[i % LOOKS.length];
          const linked = item.target_type !== 'NONE';
          return (
            <PressableScale
              onPress={linked ? () => onOpen(item) : undefined}
              disabled={!linked}
              scaleTo={0.98}
              accessibilityRole={linked ? 'button' : 'text'}
              accessibilityLabel={[item.title, item.subtitle].filter(Boolean).join('. ')}
              style={[styles.card, { width: cardWidth }]}
            >
              {look.fill === 'forest' ? (
                <>
                  <ForestFill />
                  <Jaali opacity={0.18} />
                </>
              ) : (
                <Gradient colors={look.fill} angle={20} />
              )}
              <View style={styles.text}>
                <Text variant="title" color={look.title} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text variant="caption" color={look.body} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                ) : null}
                {linked ? (
                  <View style={[styles.cta, { backgroundColor: colors[look.ctaBg] }]}>
                    <Text variant="tag" color={look.ctaFg} style={styles.ctaLabel}>
                      Shop now
                    </Text>
                    <ArrowRight size={14} strokeWidth={2.6} color={colors[look.ctaFg]} />
                  </View>
                ) : null}
              </View>
              {item.image_url ? (
                <Image
                  source={item.image_url}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </PressableScale>
          );
        }}
      />
      {banners.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: gutter, gap: GAP },
  card: {
    height: 156,
    flexDirection: 'row',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  text: { flex: 1, padding: spacing.lg, gap: spacing.xxs, justifyContent: 'center' },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  ctaLabel: { fontSize: 12 },
  image: { width: '40%', height: '100%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.borderStrong },
  dotActive: { width: 18, backgroundColor: colors.forest },
});
