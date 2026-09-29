import { GoogleLogin, useGoogleOneTapLogin } from '@react-oauth/google';
import { ShoppingBasket } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/authContext';
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

/**
 * Google One Tap with auto-select: someone who already signed in here with Google is signed in
 * again without a click and lands on the dashboard. First-timers (or after signing out) still
 * use the button. Rendered only inside GoogleOAuthProvider.
 */
function AutoSignIn({ onCredential }: { onCredential: (credential: string) => void }) {
  useGoogleOneTapLogin({
    onSuccess: ({ credential }) => {
      if (credential) onCredential(credential);
    },
    auto_select: true,
    cancel_on_tap_outside: false,
  });
  return null;
}

/** One way in: Continue with Google. New admins then add their name and mobile number. */
export function SignInPage() {
  const { status, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCredential = async (credential: string) => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(credential);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={busy || undefined}>
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
            <AutoSignIn onCredential={(c) => void onCredential(c)} />
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (credential) void onCredential(credential);
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
      </section>
    </main>
  );
}
