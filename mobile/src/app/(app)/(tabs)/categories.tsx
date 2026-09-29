import { LayoutGrid } from 'lucide-react-native';

import { EmptyState, Screen, ScreenTitle } from '@/components/ui';

export default function CategoriesScreen() {
  return (
    <Screen scroll>
      <ScreenTitle>Categories</ScreenTitle>
      <EmptyState icon={LayoutGrid} title="Nothing here yet." />
    </Screen>
  );
}
