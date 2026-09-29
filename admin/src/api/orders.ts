import { api } from '@/api/client';
import type { components } from '@/api/schema';

type S = components['schemas'];
export type AdminOrderRow = S['AdminOrderRow'];
export type AdminOrderDetail = S['AdminOrderDetailOut'];
export type OrderStatus = AdminOrderDetail['status'];
export type OrdersSummary = S['OrdersSummaryOut'];
export type Dashboard = S['DashboardOut'];
type OrderPage = S['Page_AdminOrderRow_'];

export const ORDERS_PAGE_SIZE = 20;

export type OrderFilters = { status?: OrderStatus; q?: string; offset?: number };

export const ordersKeys = {
  lists: ['admin', 'orders', 'list'] as const,
  list: (f: OrderFilters) => ['admin', 'orders', 'list', f] as const,
  detail: (id: string) => ['admin', 'orders', 'detail', id] as const,
  summary: ['admin', 'orders', 'summary'] as const,
  dashboard: ['admin', 'dashboard'] as const,
};

export const ordersApi = {
  list: (f: OrderFilters) => {
    const query = new URLSearchParams({
      limit: String(ORDERS_PAGE_SIZE),
      offset: String(f.offset ?? 0),
    });
    if (f.status) query.set('status', f.status);
    if (f.q) query.set('q', f.q);
    return api<OrderPage>(`/admin/orders?${query}`);
  },
  get: (id: string) => api<AdminOrderDetail>(`/admin/orders/${id}`),
  setStatus: (id: string, toStatus: OrderStatus, note?: string) =>
    api<AdminOrderDetail>(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: { to_status: toStatus, note: note ?? null },
    }),
  summary: () => api<OrdersSummary>('/admin/orders/summary'),
  dashboard: () => api<Dashboard>('/admin/dashboard'),
};
