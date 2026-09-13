'use client';
import { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { Category, MarketplaceCategory } from '@/types';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { ProductCard } from '@/components/customer/ProductCard';
import { CategorySideList } from '@/components/customer/CategorySideList';
import { CategoryNav } from '@/components/customer/CategoryNav';
import { Button } from '@/components/ui/Button';
import { ProductGridSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInfiniteMarketplaceProducts } from '@/hooks/useInfiniteMarketplaceProducts';
import { LoadMoreSentinel } from '@/components/common/LoadMoreSentinel';

const PAGE_SIZE = 20;

const getFetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function ProductListPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { categoryId } = useParams<{ categoryId: string }>();
  const params = useSearchParams();
  const subParam = params.get('sub');

  // Full list (stripped shape) for the sidebar / top nav. String SWR key
  // (encodes `lang` as a query-string suffix so SSR + client hash identically);
  // the actual request is still `POST /categories/list` with `{ lang }` body.
  const { data: marketplaceCategories, isLoading: catsLoading } = useSWR<MarketplaceCategory[]>(
    `/categories/list?lang=${locale}`,
    () => api.post('/categories/list', { lang: locale }).then((r) => r.data.data),
  );

  // The active category — fetched separately so we get its `subcategories[]`
  // (the stripped `/categories/list` no longer includes them).
  const { data: activeCategoryFull } = useSWR<Category | null>(
    categoryId ? `/categories/${categoryId}?lang=${locale}` : null,
    getFetcher,
  );

  // Bridge stripped MarketplaceCategory → legacy Category so existing
  // sidebar / nav components keep working. `nameAr` is set to the already-
  // localized `name` so `pickLocalized` returns it under any locale.
  // The active category's subcategories come from the per-category GET.
  const categories: Category[] | undefined = useMemo(() => {
    if (!marketplaceCategories) return undefined;
    return marketplaceCategories.map((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
      sortOrder: c.sortOrder,
      isActive: true,
      showOnHome: true,
      subcategories:
        c.id === categoryId && activeCategoryFull
          ? activeCategoryFull.subcategories
          : [],
    }));
  }, [marketplaceCategories, activeCategoryFull, categoryId]);

  const activeCategory = useMemo(
    () => categories?.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );
  const activeSubcategory = useMemo(
    () => activeCategory?.subcategories.find((s) => s.id === subParam) ?? null,
    [activeCategory, subParam]
  );

  // POST /products/list with { lang, categoryId, subcategoryId?, page, pageSize }.
  // Cache-key suffix captures every field that varies the body, so changing
  // category / subcategory / lang evicts the correct pages from cache.
  const {
    items: products,
    isLoading: productsLoading,
    isLoadingMore,
    hasMore,
    totalItems,
    loadMore,
  } = useInfiniteMarketplaceProducts({
    url: '/products/list',
    pageSize: PAGE_SIZE,
    cacheKeySuffix: `lang=${locale}&categoryId=${categoryId}&sub=${subParam ?? ''}&pageSize=${PAGE_SIZE}`,
    buildBody: (p) => ({
      lang: locale,
      page: p,
      pageSize: PAGE_SIZE,
      categoryId,
      ...(subParam && { subcategoryId: subParam }),
    }),
  });

  // If category id is invalid (loaded but not found), let the user pick.
  // Uses the marketplace list as the source of truth for existence — a
  // matching id there implies the category is public and active.
  if (!catsLoading && categories && !activeCategory) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="font-semibold text-gray-700">{t('categories.noCategories')}</p>
        <Button variant="outline" onClick={() => router.push('/categories')}>
          {t('categories.allCategories')}
        </Button>
      </div>
    );
  }

  const setSub = (subId: string | null) => {
    const next = new URLSearchParams();
    if (subId) next.set('sub', subId);
    router.replace(`/product-list/${categoryId}${next.toString() ? `?${next}` : ''}`);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Sidebar (desktop only) */}
      <aside className="hidden md:block md:w-64 md:shrink-0">
        <div className="sticky top-[140px] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl bg-white border border-gray-100 p-3 shadow-sm">
          {catsLoading || !categories ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <CategorySideList
              categories={categories}
              activeCategoryId={categoryId}
              activeSubcategoryId={subParam}
            />
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Sticky horizontal category nav (replaces mobile drawer + old subcategory tabs) */}
        {catsLoading || !categories ? (
          <div className="-mx-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ) : (
          <CategoryNav
            categories={categories}
            activeCategoryId={categoryId}
            activeSubcategoryId={subParam}
            onSubChange={setSub}
          />
        )}

        {/* Active heading */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate sm:text-xl">
              {activeSubcategory
                ? pickLocalized(activeSubcategory, locale)
                : activeCategory
                  ? pickLocalized(activeCategory, locale)
                  : '…'}
            </h1>
          </div>
          {totalItems > 0 && (
            <span className="shrink-0 text-xs text-gray-500">
              {totalItems} {t('products.products')}
            </span>
          )}
        </div>

        {/* Grid */}
        {productsLoading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <EmptyState
            title={t('products.noProducts')}
            description={t('products.trySomethingElse')}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <LoadMoreSentinel
              onLoadMore={loadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              totalShown={products.length}
              totalItems={totalItems}
            />
          </>
        )}
      </div>
    </div>
  );
}
