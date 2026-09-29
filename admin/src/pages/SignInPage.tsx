import { ShoppingBasket } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/authContext';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { SHOP_URL } from '@/lib/config';
import { goTo } from '@/lib/navigation';

import styles from './SignInPage.module.css';

/** Where everyone signs in: the shop's Welcome screen (one page for customers and admins). */
export const SIGN_IN_URL = `${SHOP_URL}/welcome`;

/**
 * The admin has no sign-in form of its own. People sign in once, on the shop's Welcome screen;
 * an admin is then sent here with a one-time `?handoff=` code, which this page exchanges for an
 * admin session. Without a code, it sends the visitor to that single sign-in page.
 */
export function SignInPage() {
  const { status, redeemHandoff } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const code = params.get('handoff');
  const [failed, setFailed] = useState<string | null>(null);
  // The code works once; React's development double-run of effects must not spend it twice.
  const redeemed = useRef(false);

  useEffect(() => {
    // Wait for the start-up session check to settle ('loading'): if it finished after the
    // redeem, it would clear the session the code just created.
    if (!code || redeemed.current || status !== 'signedOut') return;
    redeemed.current = true;
    // Drop the code from the address bar and history straight away.
    window.history.replaceState(null, '', location.pathname);
    redeemHandoff(code).catch((e: unknown) =>
      setFailed(
        e instanceof ApiError && e.code !== 'NETWORK_ERROR'
          ? e.message
          : "Couldn't reach the server. Check that the backend is running.",
      ),
    );
  }, [code, redeemHandoff, status, location.pathname]);

  const waitingForCode = Boolean(code) && !failed;
  useEffect(() => {
    // Nothing to redeem and not signed in: go to the one sign-in page.
    if (status === 'signedOut' && !code && !failed) goTo(SIGN_IN_URL);
  }, [status, code, failed]);

  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }
  if (status === 'loading' || waitingForCode) return <FullPageSpinner />;

  return (
    <main className={styles.page}>
      <section className={styles.card} role={failed ? 'alert' : 'status'}>
        <span className={styles.mark} aria-hidden>
          <ShoppingBasket size={24} strokeWidth={2} />
        </span>
        <h1 className={styles.title}>Bada Bazar admin</h1>
        {failed ? (
          <p className={styles.error}>{failed}</p>
        ) : (
          <p className={styles.subtitle}>Taking you to the Bada Bazar sign-in page…</p>
        )}
        <a className={styles.shopLink} href={SIGN_IN_URL}>
          {failed ? 'Sign in again' : 'Go to sign-in'}
        </a>
      </section>
    </main>
  );
}
