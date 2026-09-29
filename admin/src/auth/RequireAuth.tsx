import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/auth/authContext';
import { FullPageSpinner } from '@/components/FullPageSpinner';

/** UI-side guard only. The API enforces admin access on every /admin request regardless. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedOut') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return children;
}
