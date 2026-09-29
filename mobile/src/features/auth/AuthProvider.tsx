import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type AuthResponse, authApi, type User } from '@/api/auth';
import { ApiError, configureApiSession } from '@/api/client';
import { getGoogleIdToken, signOutOfGoogle } from '@/features/auth/googleSignIn';
import { tokenStore } from '@/features/auth/tokenStore';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Resolves false if the person cancelled the Google picker. */
  signInWithGoogle: () => Promise<boolean>;
  signInWithDevEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (changes: { name?: string; phone?: string }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const [attempt, setAttempt] = useState(0);

  const endSession = useCallback(async () => {
    accessToken.current = null;
    await tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const acceptAuth = useCallback(async (auth: AuthResponse) => {
    accessToken.current = auth.access_token;
    if (auth.refresh_token) await tokenStore.setRefreshToken(auth.refresh_token);
    setUser(auth.user);
    setStatus('signedIn');
  }, []);

  /** Single-flight: concurrent 401s share one refresh request (a second would trip reuse detection). */
  const refreshAccessToken = useCallback((): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const stored = await tokenStore.getRefreshToken();
        if (!stored) return null;
        try {
          const auth = await authApi.refresh(stored);
          await acceptAuth(auth);
          return auth.access_token;
        } catch (error) {
          if (error instanceof ApiError && !error.isNetworkError) await endSession();
          return null;
        }
      })().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  }, [acceptAuth, endSession]);

  useEffect(() => {
    configureApiSession({ getAccessToken: () => accessToken.current, refreshAccessToken });
  }, [refreshAccessToken]);

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await tokenStore.getRefreshToken();
      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const auth = await authApi.refresh(stored);
        if (!cancelled) await acceptAuth(auth);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.isNetworkError) setStatus('unreachable');
        else await endSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, acceptAuth, endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithGoogle: async () => {
        const idToken = await getGoogleIdToken();
        if (!idToken) return false;
        await acceptAuth(await authApi.signInWithGoogle(idToken));
        return true;
      },
      signInWithDevEmail: async (email) => {
        await acceptAuth(await authApi.devLogin(email));
      },
      signOut: async () => {
        try {
          await authApi.logout();
        } catch {
          // Signing out locally must always work, even offline.
        }
        await signOutOfGoogle();
        await endSession();
      },
      updateProfile: async (changes) => {
        setUser(await authApi.updateMe(changes));
      },
      deleteAccount: async () => {
        await authApi.deleteMe();
        await signOutOfGoogle();
        await endSession();
      },
      retry: () => {
        setStatus('loading');
        setAttempt((n) => n + 1);
      },
    }),
    [status, user, acceptAuth, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
