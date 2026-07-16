'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { HomeProductCard, Product } from '@/types';
import { aggregateCardToProduct } from '@/lib/homeAggregate';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface FeaturedStripProps {
  /** Pre-fetched aggregate cards; when set, the internal SWR fetch is skipped. */
  featured?: HomeProductCard[];
  /** Aggregate-mode loading flag (piped from useHomeAggregate). */
  isLoading?: boolean;
}

export function FeaturedStrip({ featured, isLoading: loadingProp }: FeaturedStripProps = {}) {
  const t = useTranslations('products');
  const useProps = featured !== undefined;
  const { data, isLoading: swrLoading } = useSWR<Product[]>(
    useProps ? null : '/products/featured',
    fetcher,
  );
  const isLoading = useProps ? Boolean(loadingProp) : swrLoading;

  const products: Product[] = useProps
    ? featured!.map(aggregateCardToProduct)
    : data ?? [];

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">{t('featuredForYou')}</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start">
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((product) => (
              <div key={product.id} className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start">
                <ProductCard product={product} />
              </div>
            ))}
      </div>
    </section>
  );
}
