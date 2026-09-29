import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Address } from '@/api/addresses';
import { useToast } from '@/components/Toast';
import { Button, Chip, Input, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  type AddressErrors,
  type AddressFormState,
  initialAddressState,
  LABEL_PRESETS,
  toAddressBody,
  validateAddress,
} from '@/features/addresses/addressForm';
import {
  selectCheckoutAddress,
  useAddresses,
  useAddressMutations,
} from '@/features/addresses/hooks';
import { normalisePhoneInput } from '@/lib/validation';
import { colors, gutter, spacing } from '@/theme/tokens';

/** Add (no id) or edit (?id=) an address. `?select=1` picks the new address for checkout. */
export default function AddressFormScreen() {
  const { id, select } = useLocalSearchParams<{ id?: string; select?: string }>();
  const addresses = useAddresses();
  const existing = id ? addresses.data?.find((a) => a.id === id) : undefined;

  // Editing waits for the list (usually cached already) so the form starts filled in.
  if (id && !existing) {
    return addresses.isPending ? null : (
      <View style={styles.missing}>
        <Text variant="body" color="textSecondary" align="center">
          This address was removed.
        </Text>
      </View>
    );
  }
  return <AddressForm key={existing?.id ?? 'new'} id={id} selectAfterSave={select === '1'} />;
}

function AddressForm({ id, selectAfterSave }: { id?: string; selectAfterSave: boolean }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const { create, update } = useAddressMutations();
  const toast = useToast();
  const existing = id ? addresses.data?.find((a) => a.id === id) : undefined;

  const [form, setForm] = useState<AddressFormState>(() =>
    initialAddressState(existing, { name: user?.name, phone: user?.phone }),
  );
  const [errors, setErrors] = useState<AddressErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const customLabel = !(LABEL_PRESETS as readonly string[]).includes(form.label);
  const [showCustomLabel, setShowCustomLabel] = useState(customLabel);

  const set = <K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Once they've tried to save, errors update as they type.
    if (submitted) setErrors(validateAddress(next));
  };

  const saving = create.isPending || update.isPending;

  const save = () => {
    setSubmitted(true);
    const found = validateAddress(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    const body = toAddressBody(form);
    const done = (saved: Address) => {
      if (!saved.is_serviceable) toast.show(`Saved. We don't deliver to ${saved.pincode} yet.`);
      router.back();
    };
    const onError = (e: unknown) =>
      setServerError(e instanceof ApiError ? e.message : "Couldn't save. Try again?");
    if (existing) {
      update.mutate({ id: existing.id, body }, { onSuccess: done, onError });
    } else {
      create.mutate(
        { ...body, is_default: false },
        {
          onSuccess: (created) => {
            if (selectAfterSave) selectCheckoutAddress(created.id);
            done(created);
          },
          onError,
        },
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: existing ? 'Edit address' : 'Add address' }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Text variant="label">Save as</Text>
          <View style={styles.chips}>
            {LABEL_PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={preset}
                selected={preset === 'Other' ? showCustomLabel : form.label === preset}
                onPress={() => {
                  if (preset === 'Other') {
                    setShowCustomLabel(true);
                    set('label', customLabel ? form.label : '');
                  } else {
                    setShowCustomLabel(false);
                    set('label', preset);
                  }
                }}
              />
            ))}
          </View>
          {showCustomLabel ? (
            <Input
              label="Name for this address"
              value={form.label}
              onChangeText={(v) => set('label', v)}
              placeholder="e.g. Parents' home"
              maxLength={30}
              error={errors.label}
            />
          ) : null}
        </View>

        <Input
          label="House / flat / floor"
          value={form.line1}
          onChangeText={(v) => set('line1', v)}
          autoComplete="street-address"
          maxLength={200}
          error={errors.line1}
        />
        <Input
          label="Street and area (optional)"
          value={form.line2}
          onChangeText={(v) => set('line2', v)}
          maxLength={200}
        />
        <Input
          label="Landmark (optional)"
          value={form.landmark}
          onChangeText={(v) => set('landmark', v)}
          placeholder="e.g. Near the post office"
          maxLength={120}
        />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Input
              label="PIN code"
              value={form.pincode}
              onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="postal-code"
              maxLength={6}
              error={errors.pincode}
            />
          </View>
          <View style={styles.col}>
            <Input
              label="City"
              value={form.city}
              onChangeText={(v) => set('city', v)}
              maxLength={60}
              error={errors.city}
            />
          </View>
        </View>
        <Input
          label="State"
          value={form.state}
          onChangeText={(v) => set('state', v)}
          maxLength={60}
          error={errors.state}
        />

        <View style={styles.divider} />

        <Input
          label="Receiver's name"
          value={form.recipientName}
          onChangeText={(v) => set('recipientName', v)}
          autoComplete="name"
          maxLength={80}
          error={errors.recipientName}
        />
        <Input
          label="Receiver's mobile"
          value={form.phone}
          onChangeText={(v) => set('phone', normalisePhoneInput(v))}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={13}
          error={errors.phone}
          hint="The delivery person calls this number"
        />
        {serverError ? (
          <Text variant="caption" color="danger">
            {serverError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.sm + insets.bottom }]}>
        <Button title="Save address" fullWidth loading={saving} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  missing: { flex: 1, justifyContent: 'center', padding: gutter },
  form: { padding: gutter, gap: spacing.md, paddingBottom: spacing.xl },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.xs },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
