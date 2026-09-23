'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { ProductImage } from '@/components/common/ProductImage';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Search as SearchIcon, X, Clock, ScanBarcode } from 'lucide-react';
import api from '@/lib/api';
import { MarketplaceProduct, MarketplaceProductSuggestion } from '@/types';
import { useSearchStore } from '@/stores/searchStore';
import { useLocale } from '@/i18n/useLocale';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInfiniteMarketplaceProducts } from '@/hooks/useInfiniteMarketplaceProducts';
import { LoadMoreSentinel } from '@/components/common/LoadMoreSentinel';

const SEARCH_PAGE_SIZE = 20;

interface BarcodeResult {
  products: MarketplaceProduct[];
  matchedProductId: string | null;
}

function isLikelyBarcode(q: string): boolean {
  const trimmed = q.trim();
  return /^\d{8,}$/.test(trimmed);
}

export default function SearchPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const initialBarcode = params.get('barcode') ?? '';

  const [query, setQuery] = useState(initialBarcode || initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const recent = useSearchStore((s) => s.recent);
  const pushRecent = useSearchStore((s) => s.pushRecent);
  const clearRecent = useSearchStore((s) => s.clearRecent);

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const trimmedQuery = debouncedQuery.trim();
  const barcodeMode = trimmedQuery.length > 0 && isLikelyBarcode(trimmedQuery);
  const textMode = trimmedQuery.length > 0 && !barcodeMode;

  // Barcode mode: single exact POST lookup, no pagination.
  const barcodeKey = barcodeMode
    ? `/products/search?mode=barcode&lang=${locale}&q=${encodeURIComponent(trimmedQuery)}`
    : null;
  const { data: barcodeResults, isLoading: barcodeSearching } = useSWR<BarcodeResult>(
    barcodeKey,
    () =>
      api
        .post('/products/search', {
          q: trimmedQuery,
          barcode: trimmedQuery,
          lang: locale,
          page: 1,
          pageSize: 1,
        })
        .then((r) => r.data.data),
  );

  // Text mode: server-side paginated infinite scroll via POST /products/search.
  const {
    items: textResults,
    isLoading: textSearching,
    isLoadingMore: textLoadingMore,
    hasMore: textHasMore,
    totalItems: textTotalItems,
    loadMore: loadMoreText,
  } = useInfiniteMarketplaceProducts({
    url: '/products/search',
    pageSize: SEARCH_PAGE_SIZE,
    cacheKeySuffix: `lang=${locale}&q=${encodeURIComponent(trimmedQuery)}&pageSize=${SEARCH_PAGE_SIZE}&mode=${textMode ? 'text' : 'idle'}`,
    buildBody: (p) =>
      textMode
        ? { q: trimmedQuery, lang: locale, page: p, pageSize: SEARCH_PAGE_SIZE }
        : null,
  });

  const suggestionsKey = useMemo(() => {
    if (!textMode || trimmedQuery.length < 2) return null;
    return `/products/search/suggestions?lang=${locale}&q=${encodeURIComponent(trimmedQuery)}`;
  }, [textMode, trimmedQuery, locale]);
  const { data: suggestions } = useSWR<MarketplaceProductSuggestion[]>(
    suggestionsKey,
    () =>
      api
        .post('/products/search/suggestions', { q: trimmedQuery, lang: locale })
        .then((r) => r.data.data),
  );

  const hasQuery = trimmedQuery.length > 0;
  const products = barcodeMode ? barcodeResults?.products ?? [] : textResults;
  const searching = barcodeMode ? barcodeSearching : textSearching && textResults.length === 0;
  const totalShown = products.length;
  const totalItems = barcodeMode ? (barcodeResults?.products.length ?? 0) : textTotalItems;

  // Record the search term in recents once results come back
  useEffect(() => {
    if (textMode && textResults.length > 0) {
      pushRecent(trimmedQuery);
    }
    if (barcodeMode && (barcodeResults?.products.length ?? 0) > 0) {
      pushRecent(trimmedQuery);
    }
  }, [textMode, textResults.length, barcodeMode, barcodeResults?.products.length, trimmedQuery, pushRecent]);

  const submitRecent = (term: string) => setQuery(term);

  return (
    <div className="-mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] flex-col bg-white">
      {/* Search input row */}
      <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="relative flex-1">
          {isLikelyBarcode(query) ? (
            <ScanBarcode className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
          ) : (
            <SearchIcon className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          )}
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="w-full rounded-xl bg-gray-100 py-2.5 ps-9 pe-9 text-sm focus:bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-300 focus:outline-none border border-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('common.clear')}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Recent (when no query) */}
        {!hasQuery && (
          <section className="space-y-3">
            {recent.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="h-4 w-4" />
                    <h2 className="text-sm font-semibold">{t('common.search')}</h2>
                  </div>
                  <button
                    onClick={clearRecent}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {t('common.clear')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((term) => (
                    <button
                      key={term}
                      onClick={() => submitRecent(term)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title={t('common.search')}
                description={t('common.searchPlaceholder')}
              />
            )}
          </section>
        )}

        {/* Suggestions (compact list above results) */}
        {hasQuery && suggestions && suggestions.length > 0 && (
          <section className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.search')}</p>
            <ul className="divide-y divide-gray-50 rounded-2xl border border-gray-100 bg-white">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/product-details/${s.id}`)}
                    className="flex w-full items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                      <ProductImage src={s.imageUrl} altSrc={s.imageUrlAlt} fallbackSrc={s.imageUrlFallback} alt={s.name} fill sizes="36px" className="object-cover" />
                    </div>
                    <div className="flex-1 text-start min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Results */}
        {hasQuery && (
          <section className="space-y-3">
            {searching ? (
              <ProductGridSkeleton count={6} />
            ) : products.length === 0 ? (
              <EmptyState
                title={t('products.noProducts')}
                description={t('common.searchPlaceholder')}
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {totalItems > 0 ? `${totalShown} / ${totalItems}` : totalShown}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {textMode && (
                  <LoadMoreSentinel
                    onLoadMore={loadMoreText}
                    hasMore={textHasMore}
                    isLoadingMore={textLoadingMore}
                    totalShown={totalShown}
                    totalItems={totalItems}
                  />
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
