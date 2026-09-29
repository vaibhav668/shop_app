import { type AdminProduct, adminCatalogApi, type ProductFilters } from '@/api/catalog';
import { api } from '@/api/client';
import type { components } from '@/api/schema';

type S = components['schemas'];
export type BulkStockRow = S['BulkStockRow'];
export type BulkStockResult = S['BulkStockOut'];
export type StockConflict = S['StockConflict'];
export type Movement = S['MovementOut'];
export type CustomerRow = S['CustomerRow'];
export type CustomerDetail = S['CustomerDetailOut'];
type MovementPage = S['Page_MovementOut_'];
type CustomerPage = S['Page_CustomerRow_'];

const MAX_PAGE = 50;

export const inventoryKeys = {
  all: ['admin', 'inventory'] as const,
  quick: (f: ProductFilters) => ['admin', 'inventory', 'quick', f] as const,
  movements: (productId: string) => ['admin', 'inventory', 'movements', productId] as const,
  customers: (q: string, offset: number) => ['admin', 'customers', { q, offset }] as const,
  customer: (id: string) => ['admin', 'customer', id] as const,
};

export const inventoryApi = {
  adjust: (productId: string, delta: number, note?: string) =>
    api<{ product_id: string; stock_quantity: number }>(
      `/admin/products/${productId}/stock-adjust`,
      { method: 'POST', body: { delta, note: note ?? null } },
    ),
  bulk: (updates: BulkStockRow[]) =>
    api<BulkStockResult>('/admin/inventory/bulk', { method: 'POST', body: { updates } }),
  movements: (productId: string, offset = 0) =>
    api<MovementPage>(
      `/admin/inventory/movements?product_id=${productId}&limit=20&offset=${offset}`,
    ),
  /** Every product matching the filters (the shop has hundreds, not thousands). */
  allProducts: async (f: Omit<ProductFilters, 'offset' | 'limit'>): Promise<AdminProduct[]> => {
    const items: AdminProduct[] = [];
    for (let offset = 0; ; offset += MAX_PAGE) {
      const page = await adminCatalogApi.products({ ...f, offset, limit: MAX_PAGE });
      items.push(...page.items);
      if (items.length >= page.total || page.items.length === 0) return items;
    }
  },
  customers: (q: string, offset: number) => {
    const query = new URLSearchParams({ limit: '20', offset: String(offset) });
    if (q) query.set('q', q);
    return api<CustomerPage>(`/admin/customers?${query}`);
  },
  customer: (id: string) => api<CustomerDetail>(`/admin/customers/${id}`),
};
