import { ShoppingBasket } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { TextField } from '@/components/form/Fields';

import styles from './SignInPage.module.css';

/** Same rule as the server: a 10-digit Indian mobile number starting 6–9. */
const MOBILE = /^[6-9]\d{9}$/;

/** Drops spaces, dashes and a leading +91 / 0, which people often type. */
function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2, 12);
  if (digits.length > 10 && digits.startsWith('0')) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

/** Shown once, on the first sign-in, before anything else: the same step customers see. */
export function CompleteProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = touched && !name.trim() ? 'Enter your name.' : null;
  const phoneError = touched && !MOBILE.test(phone) ? 'Enter a 10-digit mobile number.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !MOBILE.test(phone)) return;
    setSaving(true);
    setError(null);
    try {
      // Once saved, the account no longer needs onboarding and the dashboard opens.
      await updateProfile({ name: name.trim(), phone });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Try again?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.mark} aria-hidden>
          <ShoppingBasket size={24} strokeWidth={2} />
        </span>
        <h1 className={styles.title}>Almost there</h1>
        <p className={styles.subtitle}>Add your name and mobile number to finish signing in.</p>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
            error={nameError}
          />
          <TextField
            label="Mobile number"
            value={phone}
            onChange={(e) => setPhone(normalisePhone(e.target.value))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            error={phoneError}
            hint="10 digits, no +91 needed"
          />
          <Button type="submit" fullWidth loading={saving}>
            Continue
          </Button>
        </form>
        <button type="button" className={styles.secondaryAction} onClick={() => void signOut()}>
          Use a different account
        </button>
      </section>
    </main>
  );
}
