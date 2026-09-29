import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, floatShadow, gutter, radius, spacing } from '@/theme/tokens';

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

const DURATION_MS = 2800;

/** One short message at a time, above the tab bar. For "Only 2 left" style feedback. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ id: Date.now(), text });
    timer.current = setTimeout(() => setMessage(null), DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 132 }]}>
        {message ? (
          <Animated.View
            key={message.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(180)}
            style={styles.toast}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text variant="label" color="onAction">
              {message.text}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: gutter, right: gutter, alignItems: 'center' },
  toast: {
    ...floatShadow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    maxWidth: '100%',
  },
});
