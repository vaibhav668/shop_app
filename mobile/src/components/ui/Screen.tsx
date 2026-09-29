import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, gutter, spacing } from '@/theme/tokens';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Screens under a native header only need the bottom edge. */
  edges?: Edge[];
  padded?: boolean;
};

export function Screen({ children, scroll = false, edges = ['top'], padded = true }: ScreenProps) {
  const padding = padded ? styles.padded : null;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, padding]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: gutter, paddingTop: spacing.xs },
  scrollContent: { paddingBottom: spacing.xxxl },
});
