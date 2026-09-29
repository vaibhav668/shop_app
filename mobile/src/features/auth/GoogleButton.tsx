import { useState } from 'react';

import { Button, Text } from '@/components/ui';

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
    // Only in Expo Go, which can't run Google's native sign-in.
    return (
      <Text variant="caption" color="textSecondary" align="center">
        Open the installed Bada Bazar app to sign in with Google.
      </Text>
    );
  }

  return (
    <Button
      title="Continue with Google"
      fullWidth
      loading={busy}
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
    />
  );
}
