import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { ADMIN_URL } from '@/lib/config';
import { colors, gutter, spacing } from '@/theme/tokens';

/**
 * Web only: a shop admin who signs in here is sent on to the admin dashboard, where Google
 * signs them in automatically. (The phone app keeps admins in the shop, so they can test it.)
 */
export function AdminRedirect() {
  const { signOut } = useAuth();

  useEffect(() => {
    window.location.assign(ADMIN_URL);
  }, []);

  return (
    <View style={styles.root}>
      <BrandMark size={48} />
      <Text variant="heading" align="center">
        Opening the admin dashboard…
      </Text>
      <Button
        title="Open admin dashboard"
        variant="secondary"
        onPress={() => void Linking.openURL(ADMIN_URL)}
      />
      <Button title="Use a different account" variant="ghost" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: gutter,
    backgroundColor: colors.bg,
  },
});
