import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { colors, radius, shadow, spacing } from '@/theme/tokens';

import { getGoogleIdToken, isGoogleSignInAvailable } from './googleSignIn';

export type GoogleButtonProps = {
  /** Called with Google's ID token; the caller exchanges it for a Bada Bazar session. */
  onIdToken: (idToken: string) => Promise<void>;
  onError: (error: unknown) => void;
};

/** Android: Google's native account picker. (The web build uses GoogleButton.web.tsx.) */
export function GoogleButton({ onIdToken, onError }: GoogleButtonProps) {
  const [busy, setBusy] = useState(false);

  if (!isGoogleSignInAvailable) {
    // Only in Expo Go, which doesn't include Google's native sign-in (a development-only case).
    return (
      <Text variant="caption" color="onForestMuted" align="center">
        Google sign-in doesn&apos;t work in Expo Go. Open the Bada Bazar development build instead,
        or use the web preview.
      </Text>
    );
  }

  return (
    <PressableScale
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ busy, disabled: busy }}
      onPress={async () => {
        setBusy(true);
        try {
          const idToken = await getGoogleIdToken();
          if (idToken) await onIdToken(idToken); // null: they closed the account picker
        } catch (error) {
          onError(error);
        } finally {
          setBusy(false);
        }
      }}
      style={styles.button}
    >
      {busy ? (
        <ActivityIndicator color={colors.forest} />
      ) : (
        <>
          <View style={styles.mark}>
            <Text variant="button" color="goldBright">
              G
            </Text>
          </View>
          <Text variant="button">Continue with Google</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    ...shadow.float,
    height: 56,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
