import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { BrandMark } from '@/components/BrandMark';
import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { GoogleSignInError, isGoogleSignInAvailable } from '@/features/auth/googleSignIn';
import { colors, radius, spacing } from '@/theme/tokens';

function messageFor(error: unknown): string {
  if (error instanceof ApiError || error instanceof GoogleSignInError) return error.message;
  return "Sign-in didn't work. Try again?";
}

export default function WelcomeScreen() {
  const { signInWithGoogle, signInWithDevEmail } = useAuth();
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('');

  const run = async (kind: 'google' | 'dev', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="height" style={styles.root}>
        <View style={styles.hero}>
          <BrandMark size={56} />
          <Text variant="display" style={styles.headline}>
            Groceries from your neighbourhood shop
          </Text>
          <Text variant="body" color="textSecondary">
            Fresh stock from Daily Basket, packed and delivered by the shop itself.
          </Text>
        </View>

        <View style={styles.actions}>
          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Text variant="label" color="danger">
                {error}
              </Text>
            </View>
          ) : null}

          {isGoogleSignInAvailable ? (
            <Button
              title="Continue with Google"
              fullWidth
              loading={busy === 'google'}
              disabled={busy !== null && busy !== 'google'}
              onPress={() => run('google', signInWithGoogle)}
            />
          ) : (
            <Text variant="caption" color="textSecondary" align="center">
              Google sign-in works in the installed app build.
            </Text>
          )}

          {__DEV__ ? (
            <View style={styles.dev}>
              <Text variant="micro" color="textSecondary">
                DEVELOPMENT SIGN-IN
              </Text>
              <Input
                label="Email"
                value={devEmail}
                onChangeText={setDevEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <Button
                title="Continue with email"
                variant="secondary"
                fullWidth
                loading={busy === 'dev'}
                disabled={!devEmail.includes('@') || (busy !== null && busy !== 'dev')}
                onPress={() => run('dev', () => signInWithDevEmail(devEmail.trim()))}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.lg },
  hero: { gap: spacing.sm, paddingTop: spacing.xxxl },
  headline: { marginTop: spacing.md },
  actions: { gap: spacing.sm },
  error: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  dev: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
