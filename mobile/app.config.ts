import type { ExpoConfig } from 'expo/config';

const ANDROID_PACKAGE = process.env.APP_ANDROID_PACKAGE ?? 'com.badabazar.app';

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
