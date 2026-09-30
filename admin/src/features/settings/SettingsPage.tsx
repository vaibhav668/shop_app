import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';

import { ApiError } from '@/api/client';
import { type ShopSettings, settingsApi, settingsKeys } from '@/api/settings';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { TextArea, TextField, Toggle } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';
import { formatPaise, parseRupees } from '@/lib/money';

import {
  addPincodes,
  changes,
  type Errors,
  type FormState,
  initialState,
  parsePincodes,
  validate,
} from './settingsForm';

import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const settings = useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.get });
  // Lives here because a save re-keys (remounts) the form below.
  const [justSaved, setJustSaved] = useState(false);

  if (settings.isPending) return <FullPageSpinner />;
  if (settings.isError) {
    return <EmptyState icon={Settings} title="Couldn't load the shop settings." />;
  }
  // Keyed so a successful save re-initialises the form from what the server stored.
  return (
    <SettingsForm
      key={settings.data.updated_at ?? 'initial'}
      saved={settings.data}
      justSaved={justSaved}
      onSavedChange={setJustSaved}
    />
  );
}

function SettingsForm({
  saved,
  justSaved,
  onSavedChange,
}: {
  saved: ShopSettings;
  justSaved: boolean;
  onSavedChange: (saved: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(saved));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    onSavedChange(false);
  };

  const pending = changes(form, saved);
  const dirty = Object.keys(pending).length > 0;

  const save = useMutation({
    mutationFn: () => settingsApi.update(pending),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.all, data);
      onSavedChange(true);
    },
    onError: (e) => setServerError(e instanceof ApiError ? e.message : "Couldn't save. Try again?"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length === 0 && dirty) save.mutate();
  };

  const fee = parseRupees(form.deliveryFee);
  const freeAbove = parseRupees(form.freeDeliveryAbove);
  const minOrder = parseRupees(form.minOrder);

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title="Settings"
        description="Delivery charges, delivery area and how customers can pay."
        actions={
          <Button type="submit" loading={save.isPending} disabled={!dirty}>
            Save changes
          </Button>
        }
      />

      {serverError ? <Alert>{serverError}</Alert> : null}
      {Object.keys(errors).length > 0 ? <Alert>Fix the highlighted fields.</Alert> : null}
      {justSaved && !dirty ? (
        <p role="status" className={styles.saved}>
          Saved. Customers see the new settings right away.
        </p>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Orders</h2>
          <Toggle
            label="Accepting orders"
            description={
              form.isAcceptingOrders
                ? 'Customers can place orders now.'
                : 'Customers can browse, but checkout shows the message below.'
            }
            checked={form.isAcceptingOrders}
            onChange={(v) => set('isAcceptingOrders', v)}
          />
          <TextArea
            label="Message while closed"
            value={form.closedMessage}
            onChange={(e) => set('closedMessage', e.target.value)}
            maxLength={200}
            rows={2}
            error={errors.closedMessage}
          />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Delivery charges</h2>
          <div className={styles.threeCol}>
            <TextField
              label="Delivery fee"
              prefix="₹"
              inputMode="decimal"
              value={form.deliveryFee}
              onChange={(e) => set('deliveryFee', e.target.value)}
              error={errors.deliveryFee}
            />
            <TextField
              label="Free delivery from"
              prefix="₹"
              inputMode="decimal"
              value={form.freeDeliveryAbove}
              onChange={(e) => set('freeDeliveryAbove', e.target.value)}
              error={errors.freeDeliveryAbove}
            />
            <TextField
              label="Minimum order"
              prefix="₹"
              inputMode="decimal"
              value={form.minOrder}
              onChange={(e) => set('minOrder', e.target.value)}
              error={errors.minOrder}
            />
          </div>
          {fee !== null && freeAbove !== null && minOrder !== null ? (
            <p className={styles.summary}>
              {minOrder > 0 ? `Orders start at ${formatPaise(minOrder)}. ` : ''}
              {fee === 0
                ? 'Delivery is always free.'
                : `Orders below ${formatPaise(freeAbove)} pay ${formatPaise(fee)} delivery; from ${formatPaise(freeAbove)} it's free.`}
            </p>
          ) : null}
          <div className={styles.threeCol}>
            <TextField
              label="Delivery time (minutes)"
              inputMode="numeric"
              value={form.deliveryEta}
              onChange={(e) => set('deliveryEta', e.target.value)}
              error={errors.deliveryEta}
            />
          </div>
          <p className={styles.summary}>
            The app promises delivery in about {form.deliveryEta.trim() || '…'} minutes.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Delivery area</h2>
          <PincodeEditor
            pincodes={form.pincodes}
            onChange={(p) => set('pincodes', p)}
            emptyAcceptsAll={saved.empty_pincodes_accept_all}
          />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Payments</h2>
          <Toggle
            label="Cash on delivery"
            description="Customers pay when the order arrives."
            checked={form.codEnabled}
            onChange={(v) => set('codEnabled', v)}
          />
          <Toggle
            label="Online payment (UPI, cards)"
            description="Not set up yet. Until it is, customers only see Cash on delivery."
            checked={form.onlineEnabled}
            onChange={(v) => set('onlineEnabled', v)}
          />
          {errors.codEnabled ? (
            <span className={styles.error} role="alert">
              {errors.codEnabled}
            </span>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Shop details</h2>
          <TextField
            label="Shop name"
            value={form.shopName}
            onChange={(e) => set('shopName', e.target.value)}
            maxLength={80}
            error={errors.shopName}
          />
          <TextField
            label="Phone"
            optional
            inputMode="tel"
            value={form.shopPhone}
            onChange={(e) => set('shopPhone', e.target.value)}
            error={errors.shopPhone}
            hint="Customers can call this number about their order."
          />
          <TextArea
            label="Address"
            optional
            value={form.shopAddress}
            onChange={(e) => set('shopAddress', e.target.value)}
            maxLength={300}
            rows={2}
          />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Stock</h2>
          <TextField
            label="Low-stock alert at"
            inputMode="numeric"
            value={form.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', e.target.value)}
            error={errors.lowStockThreshold}
            hint="Products at or below this count are marked low. Each product can override it."
          />
        </section>
      </div>
    </form>
  );
}

function PincodeEditor({
  pincodes,
  onChange,
  emptyAcceptsAll,
}: {
  pincodes: string[];
  onChange: (pincodes: string[]) => void;
  emptyAcceptsAll: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const { valid, invalid } = parsePincodes(draft);
    if (valid.length) onChange(addPincodes(pincodes, valid));
    setDraft(invalid.join(' '));
    setError(invalid.length ? `Not a PIN code: ${invalid.join(', ')}` : null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // add the PIN code, don't submit the whole form
      add();
    }
  };

  return (
    <>
      <div className={styles.pinRow}>
        <TextField
          label="Add PIN codes"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="248001, 248002"
          error={error}
          hint="Separate several with commas or spaces."
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>

      {pincodes.length > 0 ? (
        <ul className={styles.chips} aria-label="Delivery PIN codes">
          {pincodes.map((p) => (
            <li key={p} className={styles.chip}>
              {p}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => onChange(pincodes.filter((x) => x !== p))}
                aria-label={`Remove ${p}`}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Alert tone="warning">
          {emptyAcceptsAll
            ? 'No PIN codes yet, so every address is accepted. That only happens in development.'
            : 'No PIN codes yet, so no address can be delivered to. Add the PIN codes you serve.'}
        </Alert>
      )}
    </>
  );
}
