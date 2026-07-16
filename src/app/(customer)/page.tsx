'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { Category } from '@/types';
import { HomeCategoriesRow } from '@/components/customer/HomeCategoriesRow';
import { BannerCarousel } from '@/components/customer/BannerCarousel';
import { FeaturedStrip } from '@/components/customer/FeaturedStrip';
import { BuyAgainStrip } from '@/components/customer/BuyAgainStrip';
import { FeaturedSectionsList } from '@/components/customer/FeaturedSectionsList';
import { AllProductsStrip } from '@/components/customer/AllProductsStrip';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { USE_HOME_AGGREGATE } from '@/lib/flags';
import { useHomeAggregate } from '@/hooks/useHomeAggregate';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

/**
 * Legacy homepage — each strip owns its own SWR fetch. Preserved
 * verbatim so flipping the flag off in prod restores the exact
 * pre-aggregation behavior.
 */
function LegacyHome() {
  const { data: categoriesData, isLoading: catsLoading } = useSWR<Category[]>(
    '/categories?home=true',
    fetcher,
  );

  const categories = categoriesData ?? [];

  return (
    <div className="space-y-5">
      <BannerCarousel />

      {catsLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-[68px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <HomeCategoriesRow categories={categories} />
      )}

      <BuyAgainStrip />
      <FeaturedStrip />
      <FeaturedSectionsList />

      <AllProductsStrip />
    </div>
  );
}

/**
 * Aggregate homepage — issues exactly one `GET /api/storefront/home`
 * request and distributes slices to strips via props. Each strip's
 * internal SWR call receives a `null` key in this mode, so aggregate
 * mode produces zero duplicate requests for the five aggregated
 * datasets (categories / banners / featured / sections / initial
 * all-products).
 *
 * BuyAgain, addresses, delivery, and per-strip skeletons are
 * intentionally NOT part of the aggregate — they continue to work
 * exactly as in legacy mode.
 *
 * Error policy: on aggregate failure we render a homepage-level error
 * banner with a Retry that calls SWR `mutate()`. We DO NOT
 * automatically fall back to legacy endpoints — that would double the
 * production load and hide real failures. We also DO NOT synthesize
 * empty aggregate data on error; the error state is visually distinct
 * from a genuine empty-data success.
 */
function AggregateHome() {
  const t = useTranslations('home');
  const { data, error, isLoading, mutate } = useHomeAggregate();

  if (error && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <p className="text-sm text-gray-700">{t('loadError')}</p>
        <Button size="sm" onClick={() => mutate()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const categories = (data?.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    slug: c.slug,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: true,
    showOnHome: true,
    subcategories: [],
  }));

  return (
    <div className="space-y-5">
      <BannerCarousel banners={data?.banners ?? []} isLoading={isLoading} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-[68px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <HomeCategoriesRow categories={categories} />
      )}

      <BuyAgainStrip />
      <FeaturedStrip featured={data?.featuredProducts ?? []} isLoading={isLoading} />
      <FeaturedSectionsList sections={data?.featuredSections ?? []} isLoading={isLoading} />

      <AllProductsStrip
        allProducts={data?.allProducts ?? { items: [], hasMore: false }}
        isLoading={isLoading}
      />
    </div>
  );
}

export default function HomePage() {
  // Build-time constant → React sees a stable component per build; no
  // conditional hook order across renders.
  if (USE_HOME_AGGREGATE) return <AggregateHome />;
  return <LegacyHome />;
}
