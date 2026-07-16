'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { HomeAllProducts, HomeSettings, Product } from '@/types';
import { aggregateCardToProduct } from '@/lib/homeAggregate';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

// Fallback used until the admin-configured limit resolves. Matches the
// backend default in settings.service.ts.
const DEFAULT_LIMIT = 20;

interface AllProductsStripProps {
  /**
   * Pre-fetched aggregate slice (initial page of the "all products"
   * strip). When provided BOTH internal SWR fetches — settings AND
   * products — are skipped so aggregate mode never re-requests page 1.
   *
   * The strip itself has no follow-up pagination; deeper browsing is
   * done through /product-list, which continues to use the legacy
   * `useInfiniteProducts` hook unchanged.
   */
  allProducts?: HomeAllProducts;
  /** Aggregate-mode loading flag (piped from useHomeAggregate). */
  isLoading?: boolean;
}

/**
 * Homepage "All Products" section.
 *
 * Renders a fixed number of products (configured by the admin via
 * `/admin/settings`) in a horizontal, snap-scrolling row instead of the
 * old infinite-scroll vertical grid. ~3.5 cards are visible at once so the
 * half-cut fourth card hints there is more to scroll. Direction follows the
 * document `dir` (RTL/LTR) automatically — flex + overflow-x respect it.
 */
export function AllProductsStrip({ allProducts, isLoading: loadingProp }: AllProductsStripProps = {}) {
  const t = useTranslations('products');
  const useProps = allProducts !== undefined;

  // The configured count drives how many we fetch. Read it first; while it
  // resolves we fall back to the default so the strip isn't blocked on it.
  const { data: home } = useSWR<HomeSettings>(
    useProps ? null : '/settings/home',
    fetcher,
  );
  const limit = home?.allProductsLimit ?? DEFAULT_LIMIT;

  const { data, isLoading: swrLoading } = useSWR<{ products: Product[] }>(
    useProps ? null : `/products?page=1&pageSize=${limit}&excludeHiddenFromHome=true`,
    fetcher,
  );
  const isLoading = useProps ? Boolean(loadingProp) : swrLoading;

  const products: Product[] = useProps
    ? allProducts!.items.map(aggregateCardToProduct)
    : data?.products ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-gray-900">{t('allProducts')}</h2>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start"
            >
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={t('noProducts')} description={t('comeBackLater')} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
