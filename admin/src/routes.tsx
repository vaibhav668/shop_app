import type { RouteObject } from 'react-router';

import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { BannersPage } from '@/features/catalog/BannersPage';
import { CategoriesPage } from '@/features/catalog/CategoriesPage';
import { ProductFormPage } from '@/features/catalog/ProductFormPage';
import { ProductsPage } from '@/features/catalog/ProductsPage';
import { NAV_ITEMS } from '@/navigation';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SectionPlaceholder } from '@/pages/SectionPlaceholder';
import { SignInPage } from '@/pages/SignInPage';

const BUILT = new Set(['/categories', '/products', '/banners']);

export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/banners', element: <BannersPage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/new', element: <ProductFormPage /> },
      { path: '/products/:id', element: <ProductFormPage /> },
      // Sections still to be built show a placeholder.
      ...NAV_ITEMS.filter((item) => !BUILT.has(item.path)).map((item) => ({
        path: item.path,
        element: <SectionPlaceholder item={item} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
