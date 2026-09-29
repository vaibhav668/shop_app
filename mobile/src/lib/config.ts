import Constants from 'expo-constants';
import { Platform } from 'react-native';

// EXPO_PUBLIC_* values are inlined at build time. Public identifiers only.
const CONFIGURED_API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '');

/**
 * In development on a phone, "localhost" means the phone itself, not the PC running the
 * backend. The dev server already knows the PC's address (the phone loaded the app from it),
 * so swap it in: http://localhost:8000 → http://<PC address>:8000. Release builds and the web
 * preview use the configured URL unchanged.
 */
export function resolveApiUrl(configured: string, devServerHost: string | undefined): string {
  if (!devServerHost) return configured;
  const pcAddress = devServerHost.split(':')[0];
  if (!pcAddress || pcAddress === 'localhost' || pcAddress === '127.0.0.1') return configured;
  return configured.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/])/, `//${pcAddress}`);
}

export const API_URL =
  __DEV__ && Platform.OS !== 'web'
    ? resolveApiUrl(CONFIGURED_API_URL, Constants.expoConfig?.hostUri)
    : CONFIGURED_API_URL;

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/** The shop's admin dashboard; admins who sign in here are handed into it. */
const CONFIGURED_ADMIN_URL = (process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:5173').replace(
  /\/$/,
  '',
);

/** On a phone in development, "localhost" is swapped for the PC's address, as for the API. */
export const ADMIN_URL =
  __DEV__ && Platform.OS !== 'web'
    ? resolveApiUrl(CONFIGURED_ADMIN_URL, Constants.expoConfig?.hostUri)
    : CONFIGURED_ADMIN_URL;
