import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/js-tabs';
import { House, LayoutGrid, ReceiptText, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CartBar } from '@/components/CartBar';
import { useUnreadCount } from '@/features/notifications/hooks';
import { colors, radius } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

const ICON_SIZE = 22;

export default function TabLayout() {
  const unread = useUnreadCount();
  return (
    <Tabs
      // The cart bar rides just above the tabs on every tab screen.
      tabBar={(props) => (
        <>
          <CartBar />
          <BottomTabBar {...props} />
        </>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <House size={ICON_SIZE} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color }) => (
            <LayoutGrid size={ICON_SIZE} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => (
            <ReceiptText size={ICON_SIZE} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <View>
              <UserRound size={ICON_SIZE} color={color} strokeWidth={1.75} />
              {unread > 0 ? (
                <View style={styles.dot} accessibilityLabel={`${unread} unread notifications`} />
              ) : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // A small green dot, not a number: "something new about your orders".
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
