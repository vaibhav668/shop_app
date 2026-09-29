import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { BrandMark } from '@/components/BrandMark';
import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { GoogleSignInError } from '@/features/auth/googleSignIn';
import { colors, radius, spacing } from '@/theme/tokens';

function messageFor(error: unknown): string {
  if (error instanceof ApiError || error instanceof GoogleSignInError) return error.message;
  return "Sign-in didn't work. Try again?";
}

/**
 * The one way in: Continue with Google. A first-time customer is then asked for their name and
 * mobile number (onboarding); a returning one goes straight to Home.
 */
export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.root}>
        <View style={styles.hero}>
          <BrandMark size={56} />
          <Text variant="display" style={styles.headline}>
            Groceries from your neighbourhood shop
          </Text>
          <Text variant="body" color="textSecondary">
            Fresh stock from Bada Bazar, packed and delivered by the shop itself.
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
          <GoogleButton
            onIdToken={async (idToken) => {
              setError(null);
              await signInWithGoogle(idToken);
            }}
            onError={(e) => setError(messageFor(e))}
          />
          <Text variant="caption" color="textTertiary" align="center">
            New here? The same button creates your account.
          </Text>
        </View>
      </View>
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
});
