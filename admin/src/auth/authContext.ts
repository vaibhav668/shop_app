import { createContext, useContext } from 'react';

import type { User } from '@/api/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Finishes a sign-in that started on the shop's single sign-in page. */
  redeemHandoff: (code: string) => Promise<void>;
  /** First sign-in: saves the name and mobile number the account is missing. */
  updateProfile: (changes: { name: string; phone: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
