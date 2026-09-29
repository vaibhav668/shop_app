import { Search } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

/** The home screen's search entry. It only navigates; typing happens on the search screen. */
export function SearchBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search for groceries"
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Search size={20} strokeWidth={1.75} color={colors.textSecondary} />
      <Text variant="body" color="textTertiary">
        Search for milk, atta, dal…
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { borderColor: colors.borderStrong },
});
