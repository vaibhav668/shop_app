import { ReceiptText } from 'lucide-react-native';

import { EmptyState, Screen, ScreenTitle } from '@/components/ui';

export default function OrdersScreen() {
  return (
    <Screen scroll>
      <ScreenTitle>Orders</ScreenTitle>
      <EmptyState icon={ReceiptText} title="You haven't placed an order yet." />
    </Screen>
  );
}
