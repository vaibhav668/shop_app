import { Image } from 'expo-image';
import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, motion } from '@/theme/tokens';

/** Product photo with memory+disk caching, or a quiet basket placeholder when there's none. */
export function ProductImage({
  uri,
  faded = false,
  iconSize = 40,
}: {
  uri: string | null;
  faded?: boolean;
  iconSize?: number;
}) {
  if (!uri) {
    return (
      <View style={styles.placeholder}>
        <ShoppingBasket size={iconSize} strokeWidth={1.5} color={colors.textTertiary} />
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
