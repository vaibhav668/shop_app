import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { BrandMark } from '@/components/BrandMark';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { ADMIN_URL } from '@/lib/config';

import { colors, gutter, spacing } from '@/theme/tokens';

export function adminHandoffUrl(code: string): string {
  return `${ADMIN_URL}/sign-in?handoff=${encodeURIComponent(code)}`;
}

/**
 * One sign-in page for everyone: when a shop admin signs in here, they are handed straight into
 * the admin dashboard, already signed in. The server gives a one-time code (and ends this shop
 * session); the dashboard exchanges the code for its own session.
 */
export function AdminRedirect() {
  const { forgetSession, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return; // once per attempt (React may run effects twice)
    started.current = attempt;
    (async () => {
      try {
        const { code } = await authApi.adminHandoff();
        const url = adminHandoffUrl(code);
        if (Platform.OS === 'web') {
          window.location.assign(url);
        } else {
          await Linking.openURL(url); // the admin dashboard is a website: open it in the browser
        }
        // The server already ended this session; forget it here so the next visit starts clean.
        await forgetSession();
      } catch (e) {
        setError(
          e instanceof ApiError && !e.isNetworkError
            ? e.message
            : "Couldn't open the admin dashboard. Check your connection and try again.",
        );
      }
    })();
  }, [attempt, forgetSession]);

  return (
    <View style={styles.root}>
      <BrandMark size={48} />
      <Text variant="heading" align="center">
        {error ? "Couldn't open the admin dashboard" : 'Opening the admin dashboard…'}
      </Text>
      {error ? (
        <>
          <Text variant="body" color="danger" align="center">
            {error}
          </Text>
          <Button
            title="Try again"
            onPress={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        </>
      ) : null}
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
