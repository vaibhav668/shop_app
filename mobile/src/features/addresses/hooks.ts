import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { type Address, type AddressCreate, addressesApi } from '@/api/addresses';
import { queryKeys } from '@/api/queryClient';

export function useAddresses() {
  return useQuery({ queryKey: queryKeys.addresses, queryFn: addressesApi.list });
}

export function useAddressMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses });

  return {
    create: useMutation({
      mutationFn: (body: AddressCreate) => addressesApi.create(body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Omit<AddressCreate, 'is_default'> }) =>
        addressesApi.update(id, body),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: addressesApi.remove, onSuccess: refresh }),
    setDefault: useMutation({ mutationFn: addressesApi.setDefault, onSuccess: refresh }),
  };
}

// --- the address chosen for this checkout -------------------------------------------------
// Kept outside navigation so the picker sheet can hand a choice back to Checkout with a plain
// router.back(). It is a per-visit choice; the saved default is changed only on purpose.

let selectedId: string | null = null;
const listeners = new Set<() => void>();

export function selectCheckoutAddress(id: string | null) {
  selectedId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedCheckoutAddressId(): string | null {
  return useSyncExternalStore(subscribe, () => selectedId);
}

/** The explicit choice if it still exists, otherwise the default, otherwise the newest. */
export function resolveCheckoutAddress(
  addresses: Address[] | undefined,
  chosenId: string | null,
): Address | null {
  if (!addresses?.length) return null;
  return (
    addresses.find((a) => a.id === chosenId) ?? addresses.find((a) => a.is_default) ?? addresses[0]
  );
}
