'use client';
import useSWR from 'swr';
import { Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useLocale } from '@/i18n/useLocale';

interface BranchInfo {
  configured: boolean;
  branch: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    phone: string | null;
  } | null;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

/**
 * Blocks the customer marketplace until the admin has configured the branch
 * coordinates. We fail open if the request fails or times out — the storefront
 * should stay usable if the gate endpoint is down, since downstream pages have
 * their own guards on checkout.
 */
export function MarketplaceGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('delivery');
  const locale = useLocale();
  const { data, isLoading, error } = useSWR<BranchInfo>(`/delivery/branch?lang=${locale}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (!error && data && !data.configured) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Construction className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t('marketplaceSetupTitle')}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{t('marketplaceSetupBody')}</p>
      </div>
    );
  }

  return <>{children}</>;
}
