import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Banner } from '@/api/catalog';
import { Text } from '@/components/ui';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const GAP = spacing.sm;

/** Promotions set by the shop. Text is drawn by the app (not baked into photos) so it stays sharp. */
export function BannerCarousel({
  banners,
  onOpen,
}: {
  banners: Banner[];
  onOpen: (banner: Banner) => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - gutter * 2;
  const [index, setIndex] = useState(0);

  if (banners.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)));

  return (
    <View>
      <FlatList
        horizontal
        data={banners}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => {
          const linked = item.target_type !== 'NONE';
          return (
            <Pressable
              onPress={linked ? () => onOpen(item) : undefined}
              disabled={!linked}
              accessibilityRole={linked ? 'button' : 'text'}
              accessibilityLabel={[item.title, item.subtitle].filter(Boolean).join('. ')}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.text}>
                <Text variant="heading" color="offerText" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text variant="caption" color="offerText" numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                ) : null}
                {linked ? (
                  <View style={styles.cta}>
                    <Text variant="label" color="text">
                      Shop now
                    </Text>
                    <ChevronRight size={16} strokeWidth={2} color={colors.text} />
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
            </Pressable>
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
    height: 148,
    flexDirection: 'row',
    borderRadius: radius.xl,
    backgroundColor: colors.offerTint,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9 },
  text: { flex: 1, padding: spacing.md, gap: spacing.xxs, justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs },
  image: { width: '42%', height: '100%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.borderStrong },
  dotActive: { width: 16, backgroundColor: colors.brand },
});
