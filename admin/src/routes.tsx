import type { RouteObject } from 'react-router';

import { AppLayout } from '@/components/layout/AppLayout';
import { NAV_ITEMS } from '@/navigation';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SectionPlaceholder } from '@/pages/SectionPlaceholder';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      ...NAV_ITEMS.map((item) => ({
        path: item.path,
        element: <SectionPlaceholder item={item} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
