import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { GOOGLE_WEB_CLIENT_ID } from '@/lib/config';

import type { GoogleButtonProps } from './GoogleButton';

/**
 * Web build: Google's own "Continue with Google" button (Google Identity Services), the same
 * one the admin uses. It returns an ID token for the web client ID, which the backend accepts.
 */
export function GoogleButton({ onIdToken, onError }: GoogleButtonProps) {
  if (!GOOGLE_WEB_CLIENT_ID) {
    return (
      <Text variant="caption" color="textSecondary" align="center">
        Google sign-in isn&apos;t configured (set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
      </Text>
    );
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_WEB_CLIENT_ID}>
      <View style={styles.center}>
        <GoogleLogin
          onSuccess={({ credential }) => {
            if (credential) onIdToken(credential).catch(onError);
          }}
          onError={() => onError(new Error("Google sign-in didn't open. Try again?"))}
          theme="outline"
          size="large"
          shape="rectangular"
          text="continue_with"
          width="320"
        />
      </View>
    </GoogleOAuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', minHeight: 44 },
});
