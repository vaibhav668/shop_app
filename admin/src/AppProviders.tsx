import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/auth/AuthProvider';
import { GOOGLE_CLIENT_ID } from '@/lib/config';

export function AppProviders({ children }: { children: ReactNode }) {
  const app = <AuthProvider>{children}</AuthProvider>;
  // Without a client ID, skip loading Google's script entirely (dev sign-in still works).
  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider>
  ) : (
    app
  );
}
