import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ForestFill, Jaali } from '@/components/decor';
import { isWebFramed, MAX_APP_WIDTH } from '@/lib/layout';
import { colors } from '@/theme/tokens';

/**
 * In a laptop browser the app is a centred phone-width column on the forest jaali, instead of
 * stretching across the window. On phones (and native) it renders its children untouched.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  if (!isWebFramed) return <>{children}</>;
  return (
    <View style={styles.backdrop}>
      <ForestFill />
      <Jaali opacity={0.14} />
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', backgroundColor: colors.forestDeep },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    shadowColor: colors.forestDeep,
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
});
