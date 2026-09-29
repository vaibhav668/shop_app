import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { cartApi, favouritesApi, type Cart } from '@/api/cart';
import type { ProductCard } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import type { CartControls } from '@/components/product/ProductCard';
import { useToast } from '@/components/Toast';
import { applyQuantity, maxQuantityFor, quantityOf } from '@/features/cart/cartMath';

const DEBOUNCE_MS = 300;

// One cart per signed-in person, so module-level bookkeeping is enough: the latest desired
// quantity per product waits here until the taps stop, then one request goes out.
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
let requestsInFlight = 0;

export function useCart() {
  return useQuery({ queryKey: queryKeys.cart, queryFn: cartApi.get, staleTime: 0 });
}

export function useCartActions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const setQuantity = useCallback(
    (product: ProductCard, quantity: number) => {
      const current = queryClient.getQueryData<Cart>(queryKeys.cart);
      const target = Math.max(0, Math.min(quantity, maxQuantityFor(product)));
      if (quantity > target) toast.show(`You can buy at most ${target} of this item.`);
      if (!current) {
        // Cart not loaded yet (slow network): skip the optimistic step, just ask the server.
        cartApi
          .setQuantity(product.id, target)
          .then((server) => queryClient.setQueryData(queryKeys.cart, server))
          .catch((error: unknown) =>
            toast.show(error instanceof ApiError ? error.message : "Couldn't update your cart."),
          );
        return;
      }

      // 1. Show the change immediately.
      void queryClient.cancelQueries({ queryKey: queryKeys.cart });
      queryClient.setQueryData<Cart>(queryKeys.cart, applyQuantity(current, product, target));

      // 2. Send only the final value once taps settle.
      const existing = pendingWrites.get(product.id);
      if (existing) clearTimeout(existing);
      pendingWrites.set(
        product.id,
        setTimeout(async () => {
          pendingWrites.delete(product.id);
          requestsInFlight += 1;
          try {
            const server = await cartApi.setQuantity(product.id, target);
            requestsInFlight -= 1;
            // Only adopt the server's cart when nothing newer is queued or in flight.
            if (requestsInFlight === 0 && pendingWrites.size === 0) {
              queryClient.setQueryData(queryKeys.cart, server);
            }
          } catch (error) {
            requestsInFlight -= 1;
            // 3. Roll back to the truth and say why.
            toast.show(
              error instanceof ApiError ? error.message : "Couldn't update your cart. Try again?",
            );
            void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
          }
        }, DEBOUNCE_MS),
      );
    },
    [queryClient, toast],
  );

  const clear = useMutation({
    mutationFn: cartApi.clear,
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart, cart),
  });

  return { setQuantity, clear };
}

/** Wires a product card's ADD / stepper to the cart. */
export function useCartControls(product: ProductCard): CartControls | undefined {
  const { data: cart } = useCart();
  const { setQuantity } = useCartActions();
  if (!cart) return undefined;
  const quantity = quantityOf(cart, product.id);
  return {
    quantity,
    onAdd: () => setQuantity(product, 1),
    onIncrement: () => setQuantity(product, quantity + 1),
    onDecrement: () => setQuantity(product, quantity - 1),
  };
}

// --- favourites ---------------------------------------------------------------------------

export function useFavouriteIds() {
  return useQuery({ queryKey: queryKeys.favouriteIds, queryFn: favouritesApi.ids });
}

export function useToggleFavourite() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ productId, on }: { productId: string; on: boolean }) =>
      on ? favouritesApi.add(productId) : favouritesApi.remove(productId),
    onMutate: async ({ productId, on }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favouriteIds });
      const previous = queryClient.getQueryData<string[]>(queryKeys.favouriteIds) ?? [];
      queryClient.setQueryData<string[]>(
        queryKeys.favouriteIds,
        on ? [...new Set([...previous, productId])] : previous.filter((id) => id !== productId),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(queryKeys.favouriteIds, context.previous);
      toast.show("Couldn't update your favourites.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favourites });
    },
  });
}
