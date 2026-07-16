'use client';
import useSWR from 'swr';
import api from '@/lib/api';
import { FeaturedSection, HomeFeaturedSection, Product } from '@/types';
import { aggregateCardToProduct } from '@/lib/homeAggregate';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface FeaturedSectionsListProps {
  /** Pre-fetched aggregate sections; when set, the internal SWR fetch is skipped. */
  sections?: HomeFeaturedSection[];
  /** Aggregate-mode loading flag (piped from useHomeAggregate). */
  isLoading?: boolean;
}

/**
 * Normalized shape used by the render below — an array of sections each
 * carrying an already-normalized `Product[]`. Both legacy and aggregate
 * paths pass through this shape so JSX stays identical.
 */
interface RenderableSection {
  id: string;
  name: string;
  nameAr: string;
  sortOrder: number;
  products: Product[];
}

export function FeaturedSectionsList({ sections: sectionsProp, isLoading: loadingProp }: FeaturedSectionsListProps = {}) {
  const locale = useLocale();
  const useProps = sectionsProp !== undefined;
  const { data, isLoading: swrLoading } = useSWR<FeaturedSection[]>(
    useProps ? null : '/featured-sections',
    fetcher,
  );
  const isLoading = useProps ? Boolean(loadingProp) : swrLoading;

  const sections: RenderableSection[] | undefined = useProps
    ? sectionsProp!.map((s) => ({
        id: s.id,
        name: s.name,
        nameAr: s.nameAr,
        sortOrder: s.sortOrder,
        products: s.products.map(aggregateCardToProduct),
      }))
    : data?.map((s) => ({
        id: s.id,
        name: s.name,
        nameAr: s.nameAr,
        sortOrder: s.sortOrder,
        products: s.items.map((item) => item.product),
      }));

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start"><ProductCardSkeleton /></div>
          ))}
        </div>
      </section>
    );
  }

  if (!sections || sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">{pickLocalized(section, locale)}</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {section.products.map((product) => (
              <div key={product.id} className="w-[28%] sm:w-[30%] md:w-[23%] lg:w-[18%] shrink-0 snap-start">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
