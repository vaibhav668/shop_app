import { Stack } from 'expo-router';

import { FlyToCartProvider } from '@/features/cart/FlyToCart';
import { PushManager } from '@/features/notifications/PushManager';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

export default function AppLayout() {
  return (
    <FlyToCartProvider>
      <PushManager />
      <AppStack />
    </FlyToCartProvider>
  );
}

function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.displayHeavy, fontSize: 18 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen
        name="order-placed"
        options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="addresses" options={{ title: 'Saved addresses' }} />
      <Stack.Screen name="addresses/form" options={{ title: 'Add address' }} />
      <Stack.Screen
        name="addresses/pick"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.6, 0.95],
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <Stack.Screen name="favourites" options={{ title: 'Favourites' }} />
      <Stack.Screen name="category/[slug]" options={{ title: '' }} />
      <Stack.Screen name="product/[id]" options={{ title: '' }} />
      <Stack.Screen name="dev/ui" options={{ title: 'UI kit' }} />
    </Stack>
  );
}
