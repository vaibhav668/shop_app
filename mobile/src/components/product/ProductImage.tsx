import { Image } from 'expo-image';
import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { artForName, ProduceArt } from '@/components/art/Produce';
import { colors, motion } from '@/theme/tokens';

/**
 * Product photo with memory+disk caching. With no photo, matching produce art is drawn from the
 * product's name (milk, bread, a sack of atta…), and a quiet basket only when nothing matches.
 */
export function ProductImage({
  uri,
  name,
  faded = false,
  iconSize = 40,
}: {
  uri: string | null;
  /** Used to choose art when there is no photo. */
  name?: string;
  faded?: boolean;
  iconSize?: number;
}) {
  const { fontScale } = useWindowDimensions();
  if (!uri) {
    const art = name ? artForName(name) : null;
    return (
      <View style={[styles.placeholder, faded && styles.faded]}>
        {art ? (
          <ProduceArt kind={art} size={Math.round(iconSize * 1.6 * Math.min(fontScale, 1.2))} />
        ) : (
          <ShoppingBasket size={iconSize} strokeWidth={1.5} color={colors.textTertiary} />
        )}
      </View>
    );
  }
  return (
    <Image
      source={uri}
      style={[styles.image, faded && styles.faded]}
      contentFit="contain"
      transition={motion.base}
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  faded: { opacity: 0.5 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
