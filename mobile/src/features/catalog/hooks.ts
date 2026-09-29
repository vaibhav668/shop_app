import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

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
