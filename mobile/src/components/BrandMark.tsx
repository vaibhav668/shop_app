import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { width: size, height: size }]}
    >
      <ShoppingBasket size={size * 0.55} strokeWidth={2} color={colors.onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
