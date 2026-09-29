import { api } from '@/api/client';
import type { components } from '@/api/schema';

type S = components['schemas'];
export type OrderSummary = S['OrderSummaryOut'];
export type OrderDetail = S['OrderDetailOut'];
export type OrderStatus = OrderDetail['status'];
export type PlaceOrderRequest = S['PlaceOrderRequest'];
export type PlaceOrderResult = S['PlaceOrderOut'];
export type OrderScope = 'active' | 'past';
type OrderPage = S['Page_OrderSummaryOut_'];

export const ordersApi = {
  place: (body: PlaceOrderRequest) => api<PlaceOrderResult>('/orders', { method: 'POST', body }),
  list: (scope: OrderScope, offset: number) =>
    api<OrderPage>(`/orders?scope=${scope}&limit=20&offset=${offset}`),
  get: (id: string) => api<OrderDetail>(`/orders/${id}`),
  cancel: (id: string, reason: string | null) =>
    api<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
};
