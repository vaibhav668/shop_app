import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { colors, gutter, spacing } from '@/theme/tokens';

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} accessibilityLiveRegion="polite">
      <View style={styles.bar}>
        <WifiOff size={16} strokeWidth={2} color={colors.onAction} />
        <Text variant="caption" color="onAction">
          You&apos;re offline. Showing what we saved earlier.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: gutter,
    paddingVertical: spacing.xs,
    backgroundColor: colors.text,
  },
});
