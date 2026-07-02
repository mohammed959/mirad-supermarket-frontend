'use client';
import { useMemo } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import { CartItem, Product } from '@/types';
import { useLocale, pickLocalized } from '@/i18n/useLocale';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

/**
 * Resolve the display name for each basket item from LIVE product data in the
 * currently-selected language — not from the name snapshotted when the item
 * was first added. This makes the basket follow the site language even for
 * items already sitting in localStorage from a previous session.
 *
 * Returns a `nameFor(item)` function. While the products load (or if a product
 * can no longer be fetched), it falls back to the stored snapshot, preferring
 * the Arabic snapshot when the locale is Arabic.
 */
export function useCartItemNames(items: CartItem[]) {
  const locale = useLocale();

  // Stable, order-independent key so SWR caches regardless of item order.
  const idsKey = useMemo(
    () => Array.from(new Set(items.map((i) => i.productId))).sort().join(','),
    [items],
  );

  const { data } = useSWR<{ products: Product[] }>(
    idsKey ? `/products?ids=${encodeURIComponent(idsKey)}&all=true&includeOutOfStock=true&pageSize=100` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.products ?? []) {
      map.set(p.id, pickLocalized(p, locale));
    }
    return map;
  }, [data, locale]);

  return (item: CartItem): string => {
    const live = nameById.get(item.productId);
    if (live) return live;
    // Fallback to the stored snapshot until live data arrives.
    return locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName;
  };
}
