import { Tabs } from 'expo-router';
import { House, LayoutGrid, ReceiptText, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CartBar } from '@/components/CartBar';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useUnreadCount } from '@/features/notifications/hooks';
import { colors, radius } from '@/theme/tokens';

const STROKE = 2;

export default function TabLayout() {
  const unread = useUnreadCount();
  return (
    <Tabs
      // The cart pill rides just above the floating tab bar on every tab screen.
      tabBar={(props) => (
        <View style={styles.dock}>
          <CartBar />
          <FloatingTabBar {...props} />
        </View>
      )}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} strokeWidth={STROKE} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid size={size} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <ReceiptText size={size} color={color} strokeWidth={STROKE} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarAccessibilityLabel:
            unread > 0 ? `Account, ${unread} unread notifications` : 'Account',
          tabBarIcon: ({ color, size }) => (
            <View>
              <UserRound size={size} color={color} strokeWidth={STROKE} />
              {unread > 0 ? <View style={styles.dot} /> : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: { backgroundColor: colors.bg },
  // A small gold dot, not a number: "something new about your orders".
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
