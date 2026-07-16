'use client';
import useSWR from 'swr';
import { HomeAggregate } from '@/types';
import { USE_HOME_AGGREGATE } from '@/lib/flags';
import { fetchHomeAggregate } from '@/lib/homeAggregate';

/**
 * SWR key for the storefront homepage aggregate.
 *
 * Exported for tests / diagnostics only — real consumers should call
 * `useHomeAggregate()` instead of building a key by hand.
 */
export const HOME_AGGREGATE_SWR_KEY = 'storefront:home';

/**
 * Fetches `GET /api/storefront/home` once per session (SWR-cached) and
 * returns the aggregate payload.
 *
 * The flag `NEXT_PUBLIC_USE_HOME_AGGREGATE` is checked here so callers
 * can invoke the hook unconditionally without triggering an HTTP
 * request when the flag is off — SWR treats a `null` key as "skip".
 *
 * Only the homepage `page.tsx` should call this hook. Child strips
 * receive their slice via props.
 */
export function useHomeAggregate() {
  return useSWR<HomeAggregate>(
    USE_HOME_AGGREGATE ? HOME_AGGREGATE_SWR_KEY : null,
    fetchHomeAggregate,
    {
      revalidateOnFocus: false,
    },
  );
}
