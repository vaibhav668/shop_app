import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
      <Stack.Screen name="favourites" options={{ title: 'Favourites' }} />
      <Stack.Screen name="category/[slug]" options={{ title: '' }} />
      <Stack.Screen name="product/[id]" options={{ title: '' }} />
      <Stack.Screen name="dev/ui" options={{ title: 'UI kit' }} />
    </Stack>
  );
}
