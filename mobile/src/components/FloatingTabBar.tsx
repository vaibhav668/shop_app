import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { PressableScale, Text } from '@/components/ui';
import { colors, radius, shadow, spacing, springs } from '@/theme/tokens';

const ICON_SIZE = 22;
const pillLayout = LinearTransition.springify()
  .damping(springs.layout.damping)
  .stiffness(springs.layout.stiffness);

/**
 * A white floating pill. The active tab grows into a labelled forest pill with a gold icon, so
 * the label always has room (the old full-width bar clipped "Categories" on small phones).
 */
export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.xs) + 4 }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.goldBright : colors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Animated.View key={route.key} layout={pillLayout}>
              <PressableScale
                onPress={onPress}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                scaleTo={0.92}
                accessibilityRole="tab"
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                accessibilityState={{ selected: focused }}
                testID={options.tabBarButtonTestID}
                style={[styles.item, focused && styles.itemActive]}
              >
                {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
                {focused ? (
                  <Animated.View entering={FadeIn.duration(220)}>
                    <Text variant="button" color="onAction" numberOfLines={1} style={styles.label}>
                      {label}
                    </Text>
                  </Animated.View>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.sm, paddingTop: 2, backgroundColor: colors.bg },
  bar: {
    ...shadow.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  item: {
    height: 48,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  itemActive: { backgroundColor: colors.forest, paddingHorizontal: 18 },
  label: { fontSize: 13 },
});
