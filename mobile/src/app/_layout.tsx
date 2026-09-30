import { useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/api/queryClient';
import { ToastProvider } from '@/components/Toast';
import { ErrorState } from '@/components/ui';
import { AdminRedirect } from '@/features/auth/AdminRedirect';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useIntroState } from '@/features/intro/introSeen';
import { colors } from '@/theme/tokens';
import { fontAssets } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { status, user, retry } = useAuth();
  const intro = useIntroState();
  const ready = status !== 'loading' && intro !== 'loading';

  // Keep the native splash up until we know where to send the person.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (status === 'unreachable') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ErrorState kind="offline" onRetry={retry} />
      </View>
    );
  }

  const signedIn = status === 'signedIn' && user !== null;
  const onboarded = signedIn && !user.needs_onboarding;

  // One sign-in page for everyone: shop admins are handed on to the admin dashboard.
  if (onboarded && user.role === 'ADMIN') return <AdminRedirect />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* First launch only: three slides, then sign-in. */}
      <Stack.Protected guard={!signedIn && intro === 'unseen'}>
        <Stack.Screen name="intro" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
