import { existsSync } from 'node:fs';

import type { ExpoConfig } from 'expo/config';

const ANDROID_PACKAGE = process.env.APP_ANDROID_PACKAGE ?? 'com.badabazar.app';

// Firebase config for push. On EAS it comes from a file environment variable
// (GOOGLE_SERVICES_JSON); locally from mobile/google-services.json (git-ignored).
// Without it the app still builds and runs; only pushes are off.
const GOOGLE_SERVICES_FILE =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync('./google-services.json') ? './google-services.json' : undefined);

const config: ExpoConfig = {
  name: 'Bada Bazar',
  slug: 'bada-bazar',
  scheme: 'badabazar',
  version: '0.1.0',

  orientation: 'portrait',

  icon: './assets/images/icon.png',

  // V1 is light-only by design.
  userInterfaceStyle: 'light',

  backgroundColor: '#FAFAF7',

  android: {
    package: ANDROID_PACKAGE,
    ...(GOOGLE_SERVICES_FILE ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),

    adaptiveIcon: {
      backgroundColor: '#FAFAF7',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },

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
      'expo-notifications',
      {
        // Small status-bar icon: must be a white-on-transparent silhouette.
        icon: './assets/images/android-icon-monochrome.png',
        color: '#16A34A',
        defaultChannel: 'orders',
      },
    ],

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

  extra: {
    eas: {
      projectId: '8c971dbd-eb2e-4d72-8017-d822d7170876',
    },
  },
};

export default config;
