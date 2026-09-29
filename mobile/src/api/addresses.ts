import { api } from '@/api/client';
import type { components } from '@/api/schema';

type S = components['schemas'];
export type Address = S['AddressOut'];
export type AddressCreate = S['AddressCreate'];
export type AddressUpdate = S['AddressUpdate'];
export type CheckoutQuote = S['CheckoutQuoteOut'];
export type CheckoutItem = S['CheckoutItem'];
export type PaymentMethod = CheckoutQuote['payment_methods'][number];

export const addressesApi = {
  list: () => api<Address[]>('/addresses'),
  create: (body: AddressCreate) => api<Address>('/addresses', { method: 'POST', body }),
  update: (id: string, body: AddressUpdate) =>
    api<Address>(`/addresses/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`/addresses/${id}`, { method: 'DELETE' }),
  setDefault: (id: string) => api<Address>(`/addresses/${id}/default`, { method: 'POST' }),
};

export const checkoutApi = {
  quote: (addressId: string, items: CheckoutItem[]) =>
    api<CheckoutQuote>('/checkout/quote', {
      method: 'POST',
      body: { address_id: addressId, items },
    }),
};
