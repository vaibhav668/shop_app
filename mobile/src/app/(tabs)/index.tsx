import { ShoppingBasket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { greetingFor } from '@/lib/greeting';
import { spacing } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="display">{greetingFor(new Date())}</Text>
        <Text variant="body" color="textSecondary">
          Fresh groceries from Daily Basket
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
