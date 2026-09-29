import type { ExpoConfig } from 'expo/config';

// Placeholder until the real package name is decided. It becomes permanent after the
// first Play Store upload, so it is overridable via env for release builds.
const ANDROID_PACKAGE = process.env.APP_ANDROID_PACKAGE ?? 'com.placeholder.dailybasket';

const config: ExpoConfig = {
  name: 'Daily Basket',
  slug: 'daily-basket',
  scheme: 'dailybasket',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // V1 is light-only by design (see docs/UI_SYSTEM.md).
  userInterfaceStyle: 'light',
  backgroundColor: '#FAFAF7',
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#FAFAF7',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // Keep the Play Store data-safety footprint minimal.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FAFAF7',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
