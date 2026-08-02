import api from './api';
import { HomeAggregate } from '@/types';
import type { Locale } from '@/i18n/config';

export { aggregateCardToProduct } from './aggregateAdapter';

/**
 * Fetch the marketplace homepage aggregate.
 *
 * Wire contract: `POST /api/storefront/home` with `{ lang }` body. The
 * backend envelope is `{success, message, data}`; the shared axios fetcher
 * convention unwraps `.data.data` once, mirrored here so SWR receives the
 * inner `HomeAggregate` directly. Do NOT double-unwrap in callers.
 */
export async function fetchHomeAggregate(lang: Locale): Promise<HomeAggregate> {
  const res = await api.post('/storefront/home', { lang });
  return res.data.data as HomeAggregate;
}
