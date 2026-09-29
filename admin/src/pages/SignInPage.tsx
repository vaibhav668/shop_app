import { GoogleLogin, googleLogout, useGoogleOneTapLogin } from '@react-oauth/google';
import { ShoppingBasket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/authContext';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { GOOGLE_CLIENT_ID, SHOP_URL } from '@/lib/config';
import { goTo } from '@/lib/navigation';

import styles from './SignInPage.module.css';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Sign-in didn't work. Try again?";
}

/** How long the "taking you to the shop" note stays before the page moves on. */
export const SHOP_REDIRECT_DELAY_MS = 1500;

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
  // A customer (not an admin) signed in here: they belong in the shop, so send them there.
  const [toShop, setToShop] = useState(false);

  useEffect(() => {
    if (!toShop) return;
    const t = setTimeout(() => goTo(SHOP_URL), SHOP_REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [toShop]);

  const onCredential = async (credential: string) => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(credential);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'FORBIDDEN') {
        // Stop Google's auto sign-in picking this account again if they come back as an admin.
        googleLogout();
        setToShop(true);
      } else {
        setError(messageFor(e));
      }
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  if (toShop) {
    return (
      <main className={styles.page}>
        <section className={styles.card} role="status">
          <span className={styles.mark} aria-hidden>
            <ShoppingBasket size={24} strokeWidth={2} />
          </span>
          <h1 className={styles.title}>Taking you to the shop…</h1>
          <p className={styles.subtitle}>
            This is the shop owner&apos;s area. Your account is set up for shopping at Bada Bazar.
          </p>
          <a className={styles.shopLink} href={SHOP_URL}>
            Go to the shop now
          </a>
          <button type="button" className={styles.secondaryAction} onClick={() => setToShop(false)}>
            I&apos;m the shop owner, use a different account
          </button>
        </section>
      </main>
    );
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
