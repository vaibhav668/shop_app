import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type Category = components['schemas']['CategoryOut'];
export type ProductCard = components['schemas']['ProductCardOut'];
export type ProductDetail = components['schemas']['ProductDetailOut'];
export type ProductPage = components['schemas']['Page_ProductCardOut_'];
export type Shop = components['schemas']['ShopOut'];
export type ProductSort = 'default' | 'price_asc' | 'price_desc';

export const PAGE_SIZE = 20;

export const catalogApi = {
  shop: () => api<Shop>('/shop'),
  categories: () => api<Category[]>('/categories'),
  category: (slug: string) => api<Category>(`/categories/${encodeURIComponent(slug)}`),
  products: (params: { categoryId?: string; sort?: ProductSort; offset?: number }) => {
    const query = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(params.offset ?? 0),
    });
    if (params.categoryId) query.set('category_id', params.categoryId);
    if (params.sort) query.set('sort', params.sort);
    return api<ProductPage>(`/products?${query}`);
  },
  product: (id: string) => api<ProductDetail>(`/products/${encodeURIComponent(id)}`),
};
