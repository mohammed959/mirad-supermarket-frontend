'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { BuyAgainEntry } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { useLocale } from '@/i18n/useLocale';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export function BuyAgainStrip() {
  const t = useTranslations();
  const locale = useLocale();
  // Customer-only store; if isAuth is true the user is necessarily a CUSTOMER,
  // so we no longer need a separate role gate.
  const isAuth = useCustomerAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useSWR<BuyAgainEntry[]>(
    isAuth ? `/orders/buy-again?lang=${locale}` : null,
    fetcher
  );

  if (!isAuth) return null;
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-brand-500" />
          <h2 className="text-base font-bold text-gray-900">{t('products.buyAgain')}</h2>
        </div>
        <Link href="/buy-again" className="text-xs font-semibold text-brand-600 hover:underline">
          {t('common.viewAll')}
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-40 shrink-0 snap-start">
                <ProductCardSkeleton />
              </div>
            ))
          : data!.map((entry) => (
              <div key={entry.product.id} className="w-40 shrink-0 snap-start">
                <ProductCard product={entry.product} />
              </div>
            ))}
      </div>
    </section>
  );
}
