import { googleLogout } from '@react-oauth/google';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AuthResponse, authApi, type User } from '@/api/auth';
import { configureApiSession } from '@/api/client';
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/auth/authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const accept = useCallback((auth: AuthResponse) => {
    accessToken.current = auth.access_token;
    setUser(auth.user);
    setStatus('signedIn');
  }, []);

  const clear = useCallback(() => {
    accessToken.current = null;
    setUser(null);
    setStatus('signedOut');
  }, []);

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = authApi
        .refresh()
        .then((auth) => {
          accept(auth);
          return auth.access_token;
        })
        .catch(() => {
          clear();
          return null;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }, [accept, clear]);

  useEffect(() => {
    configureApiSession({ getAccessToken: () => accessToken.current, refreshAccessToken });
  }, [refreshAccessToken]);

  // A page reload keeps you signed in via the refresh cookie.
  useEffect(() => {
    void refreshAccessToken();
  }, [refreshAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithGoogle: async (idToken) => accept(await authApi.signInWithGoogle(idToken)),
      updateProfile: async (changes) => setUser(await authApi.updateMe(changes)),
      signOut: async () => {
        // Stops Google's automatic sign-in, or signing out would sign straight back in.
        googleLogout();
        try {
          await authApi.logout();
        } finally {
          clear();
        }
      },
    }),
    [status, user, accept, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
