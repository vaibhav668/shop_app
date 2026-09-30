import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { BasketArt } from '@/components/art/Produce';
import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { isValidIndianMobile, normalisePhoneInput } from '@/lib/validation';
import { spacing } from '@/theme/tokens';

export default function OnboardingScreen() {
  const { user, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameError = touched && !name.trim() ? 'Enter your name' : null;
  const phoneError =
    touched && !isValidIndianMobile(phone) ? 'Enter a 10-digit mobile number' : null;

  const submit = async () => {
    setTouched(true);
    if (!name.trim() || !isValidIndianMobile(phone)) return;
    setSaving(true);
    setServerError(null);
    try {
      // On success the user no longer needs onboarding and the router moves on to Home.
      await updateProfile({ name: name.trim(), phone });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Couldn't save. Try again?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="height" style={styles.root}>
        <View style={styles.form}>
          <View style={styles.header}>
            <View style={styles.art}>
              <BasketArt size={120} />
            </View>
            <Text variant="display" accessibilityRole="header">
              Almost there
            </Text>
            <Text variant="body" color="textSecondary">
              The shop calls this number if there&apos;s a question about your delivery.
            </Text>
          </View>

          <Input
            label="Your name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            error={nameError}
          />
          <Input
            label="Mobile number"
            value={phone}
            onChangeText={(v) => setPhone(normalisePhoneInput(v))}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={13}
            placeholder="98765 43210"
            error={phoneError}
            hint="10 digits, no +91 needed"
          />
          {serverError ? (
            <Text variant="caption" color="danger">
              {serverError}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button title="Continue" fullWidth loading={saving} onPress={submit} />
          <Button title="Use a different account" variant="ghost" fullWidth onPress={signOut} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.lg },
  form: { gap: spacing.md },
  header: { gap: spacing.xs, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  art: { alignItems: 'center', marginBottom: spacing.sm },
  footer: { gap: spacing.xs },
});
