import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Retry network blips once; a 4xx won't fix itself.
      retry: (failureCount, error) =>
        failureCount < 1 &&
        (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
  },
});

/** Query keys in one place so invalidation stays consistent. */
export const queryKeys = {
  shop: ['shop'] as const,
  home: ['home'] as const,
  categories: ['categories'] as const,
  suggest: (q: string) => ['suggest', q] as const,
  search: (q: string, categoryId: string | undefined) => ['search', { q, categoryId }] as const,
  category: (slug: string) => ['categories', slug] as const,
  products: (categoryId: string | undefined, sort: string) =>
    ['products', { categoryId, sort }] as const,
  product: (id: string) => ['product', id] as const,
};
