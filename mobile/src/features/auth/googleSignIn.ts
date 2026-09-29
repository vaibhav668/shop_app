import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { GOOGLE_WEB_CLIENT_ID } from '@/lib/config';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** Google Sign-In is native code: available in development/production builds, not in Expo Go. */
export const isGoogleSignInAvailable =
  Platform.OS === 'android' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  !!GOOGLE_WEB_CLIENT_ID;

let google: GoogleModule | null = null;

function load(): GoogleModule {
  if (!google) {
    // Required lazily so Expo Go (which lacks the native module) doesn't crash on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin') as GoogleModule;
    // The web client ID makes Google issue an ID token whose audience our backend accepts.
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }
  return google;
}

export class GoogleSignInError extends Error {}

/** Returns a Google ID token, or null if the person closed the account picker. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = load();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    if (!response.data.idToken) throw new GoogleSignInError('Google did not return an ID token.');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError('Google Play services are needed to sign in.');
      }
    }
    if (error instanceof GoogleSignInError) throw error;
    throw new GoogleSignInError("Couldn't open Google sign-in. Try again?");
  }
}

/** Clears Google's cached account so the picker shows next time. */
export async function signOutOfGoogle(): Promise<void> {
  if (!isGoogleSignInAvailable) return;
  try {
    await load().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google on this device — nothing to clear.
  }
}
