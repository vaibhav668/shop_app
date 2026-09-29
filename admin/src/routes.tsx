import type { RouteObject } from 'react-router';

import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { BannersPage } from '@/features/catalog/BannersPage';
import { CategoriesPage } from '@/features/catalog/CategoriesPage';
import { ProductFormPage } from '@/features/catalog/ProductFormPage';
import { ProductsPage } from '@/features/catalog/ProductsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { QuickStockPage } from '@/features/inventory/QuickStockPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NAV_ITEMS } from '@/navigation';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SectionPlaceholder } from '@/pages/SectionPlaceholder';
import { SignInPage } from '@/pages/SignInPage';

// Every section is built; the placeholder remains for sections added to the nav later.
const BUILT = new Set([
  '/',
  '/orders',
  '/inventory',
  '/products',
  '/categories',
  '/banners',
  '/customers',
  '/settings',
]);

export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/orders', element: <OrdersPage /> },
      { path: '/inventory', element: <InventoryPage /> },
      { path: '/inventory/quick', element: <QuickStockPage /> },
      { path: '/customers', element: <CustomersPage /> },
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/banners', element: <BannersPage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/new', element: <ProductFormPage /> },
      { path: '/products/:id', element: <ProductFormPage /> },
      { path: '/settings', element: <SettingsPage /> },
      // Sections still to be built show a placeholder.
      ...NAV_ITEMS.filter((item) => !BUILT.has(item.path)).map((item) => ({
        path: item.path,
        element: <SectionPlaceholder item={item} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
