import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type Cart = components['schemas']['CartOut'];
export type CartLine = components['schemas']['CartLineOut'];
export type DeliveryRules = components['schemas']['DeliveryRules'];
type ProductPage = components['schemas']['Page_ProductCardOut_'];

export const cartApi = {
  get: () => api<Cart>('/cart'),
  setQuantity: (productId: string, quantity: number) =>
    api<Cart>(`/cart/items/${productId}`, { method: 'PUT', body: { quantity } }),
  clear: () => api<Cart>('/cart', { method: 'DELETE' }),
};

export const favouritesApi = {
  ids: () => api<string[]>('/favourites/ids'),
  list: (offset: number) => api<ProductPage>(`/favourites?limit=20&offset=${offset}`),
  add: (productId: string) => api<void>(`/favourites/${productId}`, { method: 'PUT' }),
  remove: (productId: string) => api<void>(`/favourites/${productId}`, { method: 'DELETE' }),
};
