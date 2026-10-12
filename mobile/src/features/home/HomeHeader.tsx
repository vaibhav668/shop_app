import { router } from 'expo-router';
import { Bell, ChevronDown, MapPin, Zap } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { ForestFill, Jaali } from '@/components/decor';
import { PressableScale, Text } from '@/components/ui';
import { useAddresses } from '@/features/addresses/hooks';
import { HomeSearch } from '@/features/home/HomeSearch';
import { greetingFor } from '@/lib/greeting';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

export const SHOP_TAGLINE = 'The smartest grocery shop of Thalisain';

export type HomeHeaderProps = {
  name: string | undefined;
  unread: number;
  etaMinutes: number | undefined;
};

/**
 * The compact forest header: brand and tagline, the bell, the delivery address and time
 * promise, and search, all in one block so products start high on the screen.
 */
export function HomeHeader({ name, unread, etaMinutes }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const address = addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0];
  const firstName = name?.split(' ')[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <ForestFill />
      <Jaali />
      <View style={styles.glow} aria-hidden />

      <View style={styles.row}>
        <View style={styles.brand}>
          <BrandMark size={38} />
          <View style={styles.brandText}>
            <Text variant="heading" color="onAction" accessibilityRole="header">
              Bada Bazar
            </Text>
            <Text variant="micro" color="goldBright" numberOfLines={1}>
              {SHOP_TAGLINE}
            </Text>
          </View>
        </View>
        <PressableScale
          onPress={() => router.push('/notifications')}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          style={styles.bell}
        >
          <Bell size={20} strokeWidth={2} color={colors.onAction} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text variant="tag" color="forestDeep">
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>

      <Text variant="title" color="onAction" style={styles.hello}>
        {greetingFor(new Date())}
        {firstName ? `, ${firstName}` : ''}
      </Text>

      <View style={styles.locRow}>
        <Pressable
          onPress={() => router.push(address ? '/addresses' : '/addresses/form')}
          accessibilityRole="button"
          accessibilityLabel={
            address ? `Delivering to ${address.label}, ${address.line1}. Change` : 'Add an address'
          }
          style={({ pressed }) => [styles.where, pressed && styles.wherePressed]}
        >
          <MapPin size={14} strokeWidth={2.2} color={colors.goldBright} />
          <Text variant="micro" color="onAction" numberOfLines={1} style={styles.whereText}>
            {address ? `${address.label} · ${address.line1}` : 'Add delivery address'}
          </Text>
          <ChevronDown size={14} strokeWidth={2.2} color={colors.onAction} />
        </Pressable>
        {etaMinutes ? (
          <View style={styles.eta} accessibilityLabel={`Delivery in about ${etaMinutes} minutes`}>
            <Zap size={13} strokeWidth={2.4} color={colors.forestDeep} fill={colors.forestDeep} />
            <Text variant="tag" color="forestDeep">
              {etaMinutes} min
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.search}>
        <HomeSearch />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: gutter,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.forest,
  },
  glow: {
    position: 'absolute',
    right: -60,
    top: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.gold,
    opacity: 0.14,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brandText: { flexShrink: 1 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: { marginTop: spacing.md },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  where: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glass,
  },
  wherePressed: { opacity: 0.8 },
  whereText: { flexShrink: 1 },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.goldBright,
  },
  search: { marginTop: spacing.md },
});
