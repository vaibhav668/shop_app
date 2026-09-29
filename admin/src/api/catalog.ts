import { api } from '@/api/client';
import type { components } from '@/api/schema';

type S = components['schemas'];
export type AdminCategory = S['AdminCategoryOut'];
export type AdminProduct = S['AdminProductOut'];
export type ProductPage = S['Page_AdminProductOut_'];
export type ProductCreate = S['ProductCreate'];
export type ProductUpdate = S['ProductUpdate'];
export type CategoryCreate = S['CategoryCreate'];
export type CategoryUpdate = S['CategoryUpdate'];
export type Upload = S['UploadOut'];
export type ProductStatus = 'all' | 'active' | 'inactive' | 'archived';

export type ProductFilters = {
  q?: string;
  categoryId?: string;
  status?: ProductStatus;
  lowStock?: boolean;
  offset?: number;
  limit?: number;
};

export const ADMIN_PAGE_SIZE = 20;

export const adminCatalogApi = {
  categories: () => api<AdminCategory[]>('/admin/categories'),
  createCategory: (body: CategoryCreate) =>
    api<AdminCategory>('/admin/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: CategoryUpdate) =>
    api<AdminCategory>(`/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) => api<void>(`/admin/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (ids: string[]) =>
    api<void>('/admin/categories/reorder', { method: 'POST', body: { ids } }),

  products: (f: ProductFilters) => {
    const query = new URLSearchParams({
      limit: String(f.limit ?? ADMIN_PAGE_SIZE),
      offset: String(f.offset ?? 0),
      status: f.status ?? 'all',
    });
    if (f.q) query.set('q', f.q);
    if (f.categoryId) query.set('category_id', f.categoryId);
    if (f.lowStock) query.set('low_stock', 'true');
    return api<ProductPage>(`/admin/products?${query}`);
  },
  product: (id: string) => api<AdminProduct>(`/admin/products/${id}`),
  createProduct: (body: ProductCreate) =>
    api<AdminProduct>('/admin/products', { method: 'POST', body }),
  updateProduct: (id: string, body: ProductUpdate) =>
    api<AdminProduct>(`/admin/products/${id}`, { method: 'PATCH', body }),
  archiveProduct: (id: string) => api<AdminProduct>(`/admin/products/${id}`, { method: 'DELETE' }),
  restoreProduct: (id: string) =>
    api<AdminProduct>(`/admin/products/${id}/restore`, { method: 'POST' }),
  setStock: (id: string, stock: number, expected: number) =>
    api<{ product_id: string; stock_quantity: number }>(`/admin/products/${id}/stock`, {
      method: 'PATCH',
      body: { stock, expected_stock: expected },
    }),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<Upload>('/admin/uploads/images', { method: 'POST', body: form });
  },
};

export const catalogKeys = {
  categories: ['admin', 'categories'] as const,
  products: (f: ProductFilters) => ['admin', 'products', f] as const,
  allProducts: ['admin', 'products'] as const,
  product: (id: string) => ['admin', 'product', id] as const,
};
