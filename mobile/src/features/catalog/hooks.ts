import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { catalogApi, type ProductSort } from '@/api/catalog';
import { queryKeys } from '@/api/queryClient';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: catalogApi.categories,
    staleTime: 10 * 60_000,
  });
}

export function useCategory(slug: string) {
  return useQuery({ queryKey: queryKeys.category(slug), queryFn: () => catalogApi.category(slug) });
}

export function useProducts(categoryId: string | undefined, sort: ProductSort) {
  return useInfiniteQuery({
    queryKey: queryKeys.products(categoryId, sort),
    queryFn: ({ pageParam }) => catalogApi.products({ categoryId, sort, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    enabled: categoryId !== undefined,
  });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: queryKeys.product(id), queryFn: () => catalogApi.product(id) });
}

/** Public shop info: open/closed, delivery rules and the delivery-time promise. */
export function useShop() {
  return useQuery({ queryKey: queryKeys.shop, queryFn: catalogApi.shop, staleTime: 5 * 60_000 });
}

export function useHome() {
  return useQuery({ queryKey: queryKeys.home, queryFn: catalogApi.home });
}

export function useSuggestions(q: string) {
  return useQuery({
    queryKey: queryKeys.suggest(q),
    queryFn: () => catalogApi.suggest(q),
    enabled: q.length > 0,
    staleTime: 5 * 60_000,
    // Keep the previous list visible while the next one loads, so typing feels instant.
    placeholderData: keepPreviousData,
  });
}

export function useSearchResults(q: string, categoryId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.search(q, categoryId),
    queryFn: ({ pageParam }) => catalogApi.products({ q, categoryId, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
}
