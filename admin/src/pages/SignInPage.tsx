import { GoogleLogin } from '@react-oauth/google';
import { ShoppingBasket } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/authContext';
import { Button } from '@/components/Button';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { GOOGLE_CLIENT_ID } from '@/lib/config';

import styles from './SignInPage.module.css';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return "This Google account isn't a shop admin. Ask the owner to add you.";
    }
    return error.message;
  }
  return "Sign-in didn't work. Try again?";
}

export function SignInPage() {
  const { status, signInWithGoogle, signInWithDevEmail } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const onDevSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => signInWithDevEmail(devEmail.trim()));
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.mark} aria-hidden>
          <ShoppingBasket size={24} strokeWidth={2} />
        </span>
        <h1 className={styles.title}>Bada Bazar admin</h1>
        <p className={styles.subtitle}>Sign in with the Google account the shop owner added.</p>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {GOOGLE_CLIENT_ID ? (
          <div className={styles.google}>
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (credential) void run(() => signInWithGoogle(credential));
              }}
              onError={() => setError("Google sign-in didn't open. Try again?")}
              theme="outline"
              size="large"
              text="continue_with"
              width="320"
            />
          </div>
        ) : (
          <p className={styles.note}>
            Google sign-in isn&apos;t configured yet (set <code>VITE_GOOGLE_CLIENT_ID</code>).
          </p>
        )}

        {import.meta.env.DEV ? (
          <form className={styles.dev} onSubmit={onDevSubmit}>
            <label className={styles.label} htmlFor="dev-email">
              Development sign-in
            </label>
            <input
              id="dev-email"
              className={styles.input}
              type="email"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              placeholder="owner@example.com"
              autoComplete="email"
            />
            <Button
              type="submit"
              variant="secondary"
              fullWidth
              loading={busy}
              disabled={!devEmail.includes('@')}
            >
              Continue with email
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
