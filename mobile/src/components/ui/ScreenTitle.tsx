import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme/tokens';

export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text variant="title" accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.md },
});
