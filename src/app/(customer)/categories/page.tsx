'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { CategoryImage } from '@/components/common/CategoryImage';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { MarketplaceCategory } from '@/types';
import { useLocale } from '@/i18n/useLocale';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CategoriesPage() {
  const t = useTranslations();
  const locale = useLocale();
  // String SWR key (encodes `lang` as a query-string suffix so SSR + client
  // hash identically); the actual request is `POST /categories/list` with a
  // `{ lang }` body (backend defaults to `"ar"` when the body is missing).
  const { data, isLoading } = useSWR<MarketplaceCategory[]>(
    `/categories/list?lang=${locale}`,
    () => api.post('/categories/list', { lang: locale }).then((r) => r.data.data),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('categories.allCategories')}</h1>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('categories.noCategories')} />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data.map((c) => (
            <Link
              key={c.id}
              href={`/product-list/${c.id}`}
              className="group flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-brand-50">
                <CategoryImage
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="64px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <p className="text-xs font-semibold text-gray-800 text-center leading-tight line-clamp-2">
                {c.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
