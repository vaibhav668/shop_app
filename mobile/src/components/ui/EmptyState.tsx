import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** The icon sits in a mint medallion with a soft halo, so an empty screen still feels cared for. */
export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Animated.View entering={FadeInUp.duration(320)} style={styles.container}>
      <View style={styles.halo} aria-hidden>
        <View style={styles.medallion}>
          <Icon size={34} strokeWidth={1.8} color={colors.forest} />
        </View>
      </View>
      <Text variant="title" align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  halo: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    backgroundColor: colors.tintSage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  medallion: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { marginTop: spacing.sm },
});
