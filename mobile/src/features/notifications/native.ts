/**
 * expo-notifications, loaded only where its native code exists.
 *
 * Importing the package runs `requireNativeModule(...)`, which throws in a build made before
 * notifications were added (and has nothing to do on web or in Expo Go). So it is required
 * lazily, after checking the native module is there; everywhere else this is `null` and push
 * features quietly switch off.
 */
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type NotificationsModule = typeof import('expo-notifications');

function load(): NotificationsModule | null {
  if (Platform.OS !== 'android') return null;
  // Expo Go ("StoreClient") can't receive FCM pushes for this app.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  // Missing in development builds made before notifications were added.
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}

export const Notifications: NotificationsModule | null = load();
