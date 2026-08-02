'use client';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { useMemo } from 'react';
import api from '@/lib/api';
import { MarketplaceProduct } from '@/types';

interface PaginationPayload {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PageData {
  products: MarketplaceProduct[];
  pagination: PaginationPayload;
  matchedProductId?: string | null;
}

interface Params {
  /** Base endpoint path, e.g. '/products/list' or '/products/search'. */
  url: string;
  /** Build the POST body for a given 1-based page; return `null` to disable fetching. */
  buildBody: (page: number) => Record<string, unknown> | null;
  /**
   * Stable extra suffix appended to the SWR cache key so filter changes
   * (category, subcategory, search term, lang) evict the correct pages
   * from cache. Include every field that varies the body.
   */
  cacheKeySuffix: string;
  pageSize?: number;
}

/**
 * POST-based infinite product loader for the marketplace side.
 *
 * SWR key is a plain string (`{url}?{cacheKeySuffix}&page={n}`) so SSR + client
 * hash identically and there's no array-key ambiguity. The fetcher recomputes
 * the body via `buildBody(page)` on each fetch, keeping request-shape logic
 * co-located with the caller.
 */
export function useInfiniteMarketplaceProducts({
  url,
  buildBody,
  cacheKeySuffix,
  pageSize = 20,
}: Params) {
  const getKey: SWRInfiniteKeyLoader<PageData> = (index, previous) => {
    if (previous && !previous.pagination.hasNextPage) return null;
    const body = buildBody(index + 1);
    if (body === null) return null;
    return `${url}?${cacheKeySuffix}&page=${index + 1}`;
  };

  const fetcher = async (key: string): Promise<PageData> => {
    // Recover the page number from the cache-key suffix.
    const match = key.match(/[?&]page=(\d+)(?:&|$)/);
    const page = match ? parseInt(match[1], 10) : 1;
    const body = buildBody(page);
    const res = await api.post(url, body ?? {});
    return res.data.data as PageData;
  };

  const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<PageData>(
    getKey,
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      parallel: false,
    },
  );

  const pages = data ?? [];
  const items = useMemo(() => pages.flatMap((p) => p.products), [pages]);

  const lastPage = pages[pages.length - 1];
  const hasMore = lastPage ? lastPage.pagination.hasNextPage : true;
  const totalItems = lastPage?.pagination.totalItems ?? 0;

  const isLoadingMore =
    size > 0 && typeof data?.[size - 1] === 'undefined' && !isLoading;

  return {
    items,
    pages,
    totalItems,
    pageSize,
    isLoading,
    isLoadingMore,
    isRefreshing: isValidating && !isLoading && !isLoadingMore,
    hasMore,
    loadMore: () => setSize(size + 1),
    setSize,
    mutate,
  };
}
