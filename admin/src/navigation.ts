import {
  Boxes,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  Package,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react';

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown until the section's real page lands. */
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: "Today's orders, revenue and low-stock items will show up here.",
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: ReceiptText,
    description: 'New orders will appear here, ready to accept and prepare.',
  },
  {
    path: '/inventory',
    label: 'Inventory',
    icon: Boxes,
    description: 'Update stock for many products at once from here.',
  },
  {
    path: '/products',
    label: 'Products',
    icon: Package,
    description: 'Add products with photos, prices and units here.',
  },
  {
    path: '/categories',
    label: 'Categories',
    icon: LayoutGrid,
    description: 'Group products into categories like Dairy or Bakery.',
  },
  {
    path: '/customers',
    label: 'Customers',
    icon: Users,
    description: 'Everyone who has ordered from the shop will be listed here.',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Delivery fee, minimum order and delivery area live here.',
  },
];
