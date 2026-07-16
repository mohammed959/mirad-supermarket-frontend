import api from './api';
import { HomeAggregate } from '@/types';

export { aggregateCardToProduct } from './aggregateAdapter';

/**
 * Fetch the marketplace homepage aggregate.
 *
 * The backend envelope is `{success, message, data}`; the shared axios
 * fetcher convention unwraps `.data.data` once. We mirror that here so
 * SWR receives the inner `HomeAggregate` directly and never sees the
 * envelope. Do NOT double-unwrap in callers.
 */
export async function fetchHomeAggregate(): Promise<HomeAggregate> {
  const res = await api.get('/storefront/home');
  return res.data.data as HomeAggregate;
}
