import { router } from 'expo-router';
import { ChevronRight, Heart, LogOut, Palette } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, ScreenTitle, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AccountScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'Your name, phone number and saved details will be removed. This cannot be undone.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
            } catch {
              setBusy(false);
              Alert.alert("Couldn't delete your account", 'Check your connection and try again.');
            }
          },
        },
      ],
    );

  return (
    <Screen scroll>
      <ScreenTitle>Account</ScreenTitle>

      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text variant="title" color="action">
            {user.name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.details}>
          <Text variant="bodyStrong">{user.name}</Text>
          <Text variant="caption" color="textSecondary">
            {user.email}
          </Text>
          {user.phone ? (
            <Text variant="caption" color="textSecondary" tabular>
              +91 {user.phone}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.menu}>
        <Pressable
          onPress={() => router.push('/favourites')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
        >
          <Heart size={20} strokeWidth={1.75} color={colors.text} />
          <Text variant="body" style={styles.menuLabel}>
            Favourites
          </Text>
          <ChevronRight size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button title="Sign out" icon={LogOut} variant="secondary" fullWidth onPress={signOut} />
        <Button
          title="Delete account"
          variant="danger"
          fullWidth
          loading={busy}
          onPress={confirmDelete}
        />
        {__DEV__ ? (
          <Button
            title="Open UI kit"
            icon={Palette}
            variant="ghost"
            fullWidth
            onPress={() => router.push('/dev/ui')}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1, gap: 2 },
  menu: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  menuPressed: { backgroundColor: colors.surfaceMuted },
  menuLabel: { flex: 1 },
  actions: { gap: spacing.xs, marginTop: spacing.xl },
});
