import { StyleSheet, View } from 'react-native';

import { Foil } from '@/components/decor';
import { Text } from '@/components/ui/Text';
import { type ColorName, colors, radius } from '@/theme/tokens';

export type BadgeTone =
  'foil' | 'offer' | 'warning' | 'success' | 'successSolid' | 'danger' | 'neutral';

/** A null background means gold foil. */
const tones: Record<BadgeTone, { bg: ColorName | null; fg: ColorName }> = {
  foil: { bg: null, fg: 'forestDeep' },
  offer: { bg: null, fg: 'forestDeep' },
  warning: { bg: 'goldSoft', fg: 'goldDeep' },
  success: { bg: 'brandTint', fg: 'forest' },
  successSolid: { bg: 'brand', fg: 'onAction' },
  danger: { bg: 'dangerTint', fg: 'danger' },
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = tones[tone];
  return (
    <View style={[styles.base, t.bg ? { backgroundColor: colors[t.bg] } : styles.clip]}>
      {t.bg ? null : <Foil borderRadius={radius.sm - 1} />}
      <Text variant="tag" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm - 1,
  },
  clip: { overflow: 'hidden' },
});
