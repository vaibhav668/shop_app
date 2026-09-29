import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { greetingFor } from '@/lib/greeting';
import { spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="display">
          {greetingFor(new Date())}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text variant="body" color="textSecondary">
          Fresh groceries from Bada Bazar
        </Text>
      </View>
      <EmptyState
        icon={ShoppingBasket}
        title="Nothing here yet."
        message="Products will show up here once the shop adds them."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xxs, paddingVertical: spacing.md },
});
