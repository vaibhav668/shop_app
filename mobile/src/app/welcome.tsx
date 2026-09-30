import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { BasketArt } from '@/components/art/Produce';
import { BrandLockup } from '@/components/BrandMark';
import { ForestFill, Jaali } from '@/components/decor';
import { Text } from '@/components/ui';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { GoogleSignInError } from '@/features/auth/googleSignIn';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

function messageFor(error: unknown): string {
  if (error instanceof ApiError || error instanceof GoogleSignInError) return error.message;
  return "Sign-in didn't work. Try again?";
}

/** The basket drifts gently up and down. */
function FloatingBasket() {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    y.value = withRepeat(
      withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [y, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.artWrap}>
      <View style={styles.halo} />
      <Animated.View style={style}>
        <BasketArt size={200} />
      </Animated.View>
    </View>
  );
}

/**
 * The one way in: Continue with Google. A first-time customer is then asked for their name and
 * mobile number (onboarding); a returning one goes straight to Home; the shop owner is handed
 * to the admin dashboard.
 */
export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ForestFill />
      <Jaali opacity={0.2} />
      <View style={styles.glow} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <BrandLockup size={44} onDark />
        </Animated.View>

        <FloatingBasket />

        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.copy}>
          <Text variant="hero" color="onAction">
            Fresh from your{' '}
            <Text variant="hero" color="goldBright">
              neighbourhood
            </Text>{' '}
            shop
          </Text>
          <Text variant="body" color="onForestMuted">
            Packed by the people you already buy from, at your door in minutes.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(420)} style={styles.actions}>
          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Text variant="label" color="danger">
                {error}
              </Text>
            </View>
          ) : null}
          <GoogleButton
            onIdToken={async (idToken) => {
              setError(null);
              await signInWithGoogle(idToken);
            }}
            onError={(e) => setError(messageFor(e))}
          />
          <Text variant="caption" color="onForestMuted" align="center">
            New here? The same button creates your account.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.forest },
  safe: {
    flex: 1,
    paddingHorizontal: gutter + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    right: -120,
    bottom: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.gold,
    opacity: 0.16,
  },
  artWrap: { alignItems: 'center', justifyContent: 'center', height: 240 },
  halo: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.surface,
    opacity: 0.08,
  },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  error: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
