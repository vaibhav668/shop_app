/**
 * Push notifications (Android, Firebase Cloud Messaging). Everything here is a no-op on web and
 * in Expo Go, where native FCM isn't available, so the rest of the app never has to check.
 *
 * Permission is asked after the first order (when the value is obvious), never at launch.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationsApi } from '@/api/notifications';
import { colors } from '@/theme/tokens';

/** Must match ANDROID_CHANNEL in the backend's FCM provider. */
export const ORDERS_CHANNEL = 'orders';

// Android only, and not inside Expo Go (StoreClient), which can't receive FCM pushes.
export const pushSupported =
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let registeredToken: string | null = null;

/** The token registered for this phone, sent on sign-out so the server forgets it. */
export function currentPushToken(): string | null {
  return registeredToken;
}

export async function setUpPushChannel(): Promise<void> {
  if (!pushSupported) return;
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
    name: 'Order updates',
    description: 'When your order is confirmed, packed, on its way or delivered.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.brand,
    vibrationPattern: [0, 200, 120, 200],
  });
}

/** Registers this phone with the server if the person has already allowed notifications. */
export async function registerIfPermitted(): Promise<void> {
  if (!pushSupported) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (granted) await register();
}

/**
 * Asks for permission once (Android 13+ shows the system prompt; older versions are allowed by
 * default) and registers. Returns whether notifications are on.
 */
export async function askPermissionAndRegister(): Promise<boolean> {
  if (!pushSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await register();
    return true;
  }
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.granted) await register();
  return asked.granted;
}

async function register(): Promise<void> {
  try {
    await setUpPushChannel();
    const { data } = await Notifications.getDevicePushTokenAsync();
    await sendToken(String(data));
  } catch {
    // No Firebase config in this build, or offline: the in-app list still works.
  }
}

export async function sendToken(token: string): Promise<void> {
  await notificationsApi.registerDevice(token);
  registeredToken = token;
}

export function forgetPushToken(): void {
  registeredToken = null;
}

/** Only in-app order routes are followed from a notification's data. */
export function routeFromData(data: unknown): string | null {
  const route = (data as { route?: unknown } | null)?.route;
  return typeof route === 'string' && /^\/orders\/[0-9a-f-]{36}$/.test(route) ? route : null;
}
