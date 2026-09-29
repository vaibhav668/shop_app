import { router } from 'expo-router';
import { Palette, UserRound } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, EmptyState, Screen, ScreenTitle } from '@/components/ui';

export default function AccountScreen() {
  return (
    <Screen scroll>
      <ScreenTitle>Account</ScreenTitle>
      <EmptyState
        icon={UserRound}
        title="Sign in to see your account"
        message="Your addresses, orders and favourites will live here."
      />
      {__DEV__ ? (
        <View style={{ alignItems: 'center' }}>
          <Button
            title="Open UI kit"
            icon={Palette}
            variant="ghost"
            onPress={() => router.push('/dev/ui')}
          />
        </View>
      ) : null}
    </Screen>
  );
}
