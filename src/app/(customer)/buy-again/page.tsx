'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { BuyAgainEntry } from '@/types';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/i18n/useLocale';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function BuyAgainPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { isAuthenticated } = useCustomerAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const { data, isLoading } = useSWR<BuyAgainEntry[]>(
    isAuthenticated ? `/orders/buy-again?lang=${locale}` : null,
    fetcher
  );

  const entries = data ?? [];

  if (!hydrated) return <ProductGridSkeleton count={6} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-brand-500" />
        <h1 className="text-xl font-bold text-gray-900">{t('nav.buyAgain')}</h1>
        {entries.length > 0 && (
          <span className="text-sm text-gray-400">({entries.length})</span>
        )}
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('orders.buyAgainEmpty')}
          description={t('cart.startShopping')}
          action={
            <Button size="sm" onClick={() => router.push('/')}>
              {t('cart.startShopping')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
          {entries.map((entry) => (
            <div key={entry.product.id} className="relative">
              <ProductCard product={entry.product} />
              {entry.orderCount > 1 && (
                <span className="pointer-events-none absolute start-2 top-2 z-10 rounded-full bg-brand-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  ×{entry.orderCount}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
