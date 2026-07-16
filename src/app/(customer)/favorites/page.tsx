'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import api from '@/lib/api';
import { Product } from '@/types';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface FavoriteEntry {
  favoriteId: string;
  createdAt: string;
  product: Product;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function FavoritesPage() {
  const router = useRouter();
  const t = useTranslations();
  const { isAuthenticated } = useCustomerAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const { data, isLoading } = useSWR<FavoriteEntry[]>(
    isAuthenticated ? '/favorites' : null,
    fetcher
  );

  const favorites = data ?? [];
  const isInStock = (p: { isActive: boolean; available?: boolean; stock?: number | null; reserved?: number | null }) => {
    if (!p.isActive) return false;
    if (p.available != null) return p.available;
    return (p.stock ?? 0) - (p.reserved ?? 0) > 0;
  };
  const unavailable = favorites.filter((f) => !isInStock(f.product));
  const available = favorites.filter((f) => isInStock(f.product));

  if (!hydrated) return <ProductGridSkeleton count={6} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-rose-500" />
        <h1 className="text-xl font-bold text-gray-900">{t('nav.favorites')}</h1>
        {favorites.length > 0 && (
          <span className="text-sm text-gray-400">({favorites.length})</span>
        )}
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={6} />
      ) : favorites.length === 0 ? (
        <EmptyState
          title={t('orders.favoritesEmpty')}
          description={t('auth.signInToFavorite')}
          action={
            <Button size="sm" onClick={() => router.push('/')}>
              {t('products.browseProducts')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
            {available.map((f) => (
              <ProductCard key={f.favoriteId} product={f.product} />
            ))}
          </section>

          {unavailable.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t('products.unavailable')}
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                {unavailable.map((f) => (
                  <ProductCard key={f.favoriteId} product={f.product} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
