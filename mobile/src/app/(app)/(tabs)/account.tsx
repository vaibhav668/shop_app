import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bell,
  ChevronRight,
  Heart,
  LogOut,
  MapPin,
  Palette,
  ReceiptText,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { ForestFill, Foil, Jaali } from '@/components/decor';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUnreadCount } from '@/features/notifications/hooks';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { colors, gutter, radius, shadow, spacing } from '@/theme/tokens';

type MenuItem = {
  label: string;
  icon: LucideIcon;
  tint: string;
  href: '/orders' | '/favourites' | '/addresses' | '/notifications';
  badge?: number;
};

export default function AccountScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const unread = useUnreadCount();

  if (!user) return null;

  const confirmDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Delete your account?',
      message: 'Your name, phone number and saved details will be removed. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep account',
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteAccount(); // on success the app signs out and shows the welcome screen
    } catch (e) {
      setBusy(false);
      // e.g. "You have an order in progress..." from the server, or a network problem.
      showMessage(
        "Couldn't delete your account",
        e instanceof ApiError && !e.isNetworkError
          ? e.message
          : 'Check your connection and try again.',
      );
    }
  };

  const menu: MenuItem[] = [
    { label: 'My orders', icon: ReceiptText, tint: colors.tintMint, href: '/orders' },
    {
      label: 'Notifications',
      icon: Bell,
      tint: colors.tintButter,
      href: '/notifications',
      badge: unread,
    },
    { label: 'Favourites', icon: Heart, tint: colors.tintPeach, href: '/favourites' },
    { label: 'Saved addresses', icon: MapPin, tint: colors.tintSand, href: '/addresses' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          Account
        </Text>

        <View style={styles.profile}>
          <ForestFill borderRadius={radius.xl} />
          <Jaali opacity={0.18} />
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text variant="title" color="forest">
                {user.name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.details}>
              <Text variant="heading" color="onAction" numberOfLines={1}>
                {user.name}
              </Text>
              <Text variant="caption" color="onForestMuted" numberOfLines={1}>
                {user.email}
              </Text>
              {user.phone ? (
                <Text variant="caption" color="onForestMuted" tabular>
                  +91 {user.phone}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.member}>
            <Foil borderRadius={radius.full} />
            <Text variant="tag" color="forestDeep">
              BADA BAZAR MEMBER
            </Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menu.map((item, i) => (
            <View key={item.label}>
              {i > 0 ? <View style={styles.menuDivider} /> : null}
              <Pressable
                onPress={() => router.push(item.href)}
                accessibilityRole="button"
                accessibilityLabel={item.badge ? `${item.label}, ${item.badge} unread` : item.label}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.tint }]}>
                  <item.icon size={18} strokeWidth={2} color={colors.forest} />
                </View>
                <Text variant="label" style={styles.menuLabel}>
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={styles.count}>
                    <Text variant="tag" color="forestDeep">
                      {item.badge > 9 ? '9+' : String(item.badge)}
                    </Text>
                  </View>
                ) : null}
                <ChevronRight size={18} strokeWidth={2} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Sign out" icon={LogOut} variant="secondary" fullWidth onPress={signOut} />
          <Button
            title="Delete account"
            variant="ghost"
            fullWidth
            loading={busy}
            onPress={confirmDelete}
            accessibilityLabel="Delete account"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl },
  title: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  profile: {
    ...shadow.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.forest,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.goldSoft,
    borderWidth: 2.5,
    borderColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1, gap: 2 },
  member: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  menu: {
    ...shadow.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  menuPressed: { backgroundColor: colors.surfaceMuted },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDivider: { height: 1, marginLeft: 60, backgroundColor: colors.border },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldBright,
  },
  menuLabel: { flex: 1 },
  actions: { gap: spacing.xs, marginTop: spacing.xl },
});
