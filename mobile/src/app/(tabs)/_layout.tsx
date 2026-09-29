import { Tabs } from 'expo-router';
import { House, LayoutGrid, ReceiptText, UserRound } from 'lucide-react-native';

import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

const ICON_SIZE = 22;

export default function TabLayout() {
  return (
    <Tabs
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
            <UserRound size={ICON_SIZE} color={color} strokeWidth={1.75} />
          ),
        }}
      />
    </Tabs>
  );
}
