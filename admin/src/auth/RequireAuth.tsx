import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/auth/authContext';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { CompleteProfilePage } from '@/pages/CompleteProfilePage';

/** UI-side guard only. The API enforces admin access on every /admin request regardless. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedOut') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  // First sign-in: name and mobile number come before anything else (as in the customer app).
  if (user?.needs_onboarding) return <CompleteProfilePage />;
  return children;
}
