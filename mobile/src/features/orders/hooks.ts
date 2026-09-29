import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import type { PaymentMethod } from '@/api/addresses';
import { ApiError } from '@/api/client';
import { ordersApi } from '@/api/orders';
import { queryKeys } from '@/api/queryClient';
import { useToast } from '@/components/Toast';
import { newIdempotencyKey } from '@/features/orders/orderStatus';

/** Errors that mean "what you saw is out of date": refresh the cart and quote, then retry. */
const STALE_CODES = new Set([
  'PRICE_CHANGED',
  'OUT_OF_STOCK',
  'PRODUCT_UNAVAILABLE',
  'MAX_PER_ORDER',
  'BELOW_MIN_ORDER',
  'SHOP_CLOSED',
  'NOT_SERVICEABLE',
  'PAYMENT_METHOD_DISABLED',
]);

type PlaceArgs = {
  addressId: string;
  method: PaymentMethod;
  items: { product_id: string; quantity: number }[];
  expectedTotal: number;
  note: string;
};

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const toast = useToast();
  // One key per checkout visit: a retry after a timeout returns the same order, never a second.
  const [key] = useState(newIdempotencyKey);

  return useMutation({
    mutationFn: (args: PlaceArgs) =>
      ordersApi.place({
        address_id: args.addressId,
        payment_method: args.method,
        items: args.items,
        idempotency_key: key,
        expected_total_paise: args.expectedTotal,
        customer_note: args.note.trim() || null,
      }),
    onSuccess: ({ order }) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      // Leave checkout first, so it never flashes "cart is empty" as the cart refreshes.
      router.replace({ pathname: '/order-placed', params: { id: order.id } });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allOrders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
    onError: async (error) => {
      if (error instanceof ApiError && STALE_CODES.has(error.code)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.cart }),
          queryClient.invalidateQueries({ queryKey: ['checkout-quote'] }),
        ]);
        toast.show(
          error.code === 'PRICE_CHANGED'
            ? 'Prices changed. Please check the new total.'
            : error.message,
        );
        return;
      }
      toast.show(
        error instanceof ApiError && !error.isNetworkError
          ? error.message
          : "Couldn't place the order. Check your connection and try again.",
      );
    },
  });
}
