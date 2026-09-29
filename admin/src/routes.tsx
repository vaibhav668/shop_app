import type { RouteObject } from 'react-router';

import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { NAV_ITEMS } from '@/navigation';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SectionPlaceholder } from '@/pages/SectionPlaceholder';
import { SignInPage } from '@/pages/SignInPage';

export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      ...NAV_ITEMS.map((item) => ({
        path: item.path,
        element: <SectionPlaceholder item={item} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
