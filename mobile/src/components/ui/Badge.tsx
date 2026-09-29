import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type ColorName, colors, radius } from '@/theme/tokens';

export type BadgeTone = 'offer' | 'warning' | 'success' | 'successSolid' | 'danger' | 'neutral';

const tones: Record<BadgeTone, { bg: ColorName; fg: ColorName }> = {
  offer: { bg: 'offer', fg: 'text' },
  warning: { bg: 'offerTint', fg: 'offerText' },
  success: { bg: 'brandTint', fg: 'action' },
  successSolid: { bg: 'brand', fg: 'onAction' },
  danger: { bg: 'dangerTint', fg: 'danger' },
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: colors[t.bg] }]}>
      <Text variant="micro" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm - 2,
  },
});
