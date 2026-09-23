'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { ProductImage } from '@/components/common/ProductImage';
import { useTranslations } from 'next-intl';
import {
  ShoppingBag, Clock, Truck, CheckCircle, XCircle, Banknote, AlertTriangle,
  ClipboardCheck, UserCheck, TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLocale, pickLocalized } from '@/i18n/useLocale';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface MostOrdered {
  productId: string;
  quantitySold: number;
  product: { id: string; name: string; nameAr: string; imageUrl: string | null; imageUrlAlt?: string; imageUrlFallback?: string; sku?: string | null } | null;
}

interface DashboardStats {
  newOrders: number;
  inPreparation: number;
  withDrivers: number;
  todayTotal: number;
  cancelledToday: number;
  deliveredToday: number;
  pendingPaymentReview: number;
  lowStockCount: number;
  activeDrivers: number;
  activePickers: number;
  mostOrdered: MostOrdered[];
}

interface BranchInfo {
  configured: boolean;
}

export default function AdminDashboardPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { data: stats, isLoading } = useSWR<DashboardStats>('/orders/stats', fetcher, {
    refreshInterval: 30000,
  });
  const { data: branchInfo } = useSWR<BranchInfo>('/delivery/branch', fetcher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('admin.liveOverview')}</p>
      </div>

      {branchInfo && !branchInfo.configured && (
        <Link
          href="/admin/branch-coverage"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('admin.branchNotConfiguredTitle')}</p>
            <p className="text-xs text-amber-800 mt-0.5">{t('admin.branchNotConfiguredBody')}</p>
          </div>
        </Link>
      )}

      {/* Live ops */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.liveOperations')}</h2>
        {isLoading || !stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Link href="/admin/orders?status=NEW">
              <StatsCard title={t('admin.newOrders')}     value={stats.newOrders}            icon={ShoppingBag} color="blue"   subtitle={t('admin.awaitingAction')} />
            </Link>
            <Link href="/admin/orders?status=ASSIGNED_TO_PICKER">
              <StatsCard title={t('admin.inPreparation')} value={stats.inPreparation}        icon={Clock}       color="yellow" subtitle={t('admin.beingPicked')} />
            </Link>
            <Link href="/admin/orders?status=ASSIGNED_TO_DRIVER">
              <StatsCard title={t('admin.withDrivers')}   value={stats.withDrivers}          icon={Truck}       color="brand"  subtitle={t('admin.outForDelivery')} />
            </Link>
            <Link href="/admin/orders">
              <StatsCard title={t('admin.paymentReview')} value={stats.pendingPaymentReview} icon={Banknote}    color="amber"  subtitle={t('admin.bankTransfersPending')} />
            </Link>
          </div>
        )}
      </section>

      {/* Today */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.todaySection')}</h2>
        {isLoading || !stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatsCard title={t('admin.ordersPlaced')}    value={stats.todayTotal}     icon={ShoppingBag} color="brand" />
            <StatsCard title={t('admin.ordersDelivered')} value={stats.deliveredToday} icon={CheckCircle} color="green" />
            <StatsCard title={t('admin.cancelled')}       value={stats.cancelledToday} icon={XCircle}     color="red"   />
          </div>
        )}
      </section>

      {/* Catalog & staff */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.catalogAndStaff')}</h2>
        {isLoading || !stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/inventory">
              <StatsCard
                title={t('admin.lowStockVariants')}
                value={stats.lowStockCount}
                icon={AlertTriangle}
                color={stats.lowStockCount > 0 ? 'red' : 'gray'}
                subtitle={t('admin.lowStockHint')}
              />
            </Link>
            <Link href="/admin/pickers">
              <StatsCard title={t('admin.activePickers')} value={stats.activePickers} icon={ClipboardCheck} color="violet" />
            </Link>
            <Link href="/admin/drivers">
              <StatsCard title={t('admin.activeDrivers')} value={stats.activeDrivers} icon={UserCheck}      color="violet" />
            </Link>
          </div>
        )}
      </section>

      {/* Most ordered */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('admin.mostOrdered')}</h2>
        <div className="rounded-2xl bg-white border border-gray-100">
          {isLoading || !stats ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : stats.mostOrdered.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">{t('admin.noOrders' as any) ?? t('orders.noOrders')}</p>
          ) : (
            <ol className="divide-y divide-gray-50">
              {stats.mostOrdered.map((row, i) => (
                <li key={row.productId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                    {i + 1}
                  </div>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <ProductImage src={row.product?.imageUrl} altSrc={row.product?.imageUrlAlt} fallbackSrc={row.product?.imageUrlFallback} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {row.product ? pickLocalized(row.product, locale) : ''}
                    </p>
                    {row.product?.sku && (
                      <p className="text-xs text-gray-500">SKU {row.product.sku}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-brand-600 shrink-0">
                    <TrendingUp className="h-4 w-4" /> {row.quantitySold}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">{t('admin.quickActions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('admin.newOrders'),       href: '/admin/orders?status=NEW',     color: 'bg-blue-50 text-blue-700' },
            { label: t('admin.manageProducts'),  href: '/admin/products',              color: 'bg-brand-50 text-brand-700' },
            { label: t('admin.manageBanners'),   href: '/admin/banners',               color: 'bg-violet-50 text-violet-700' },
            { label: t('admin.settings'),        href: '/admin/settings',              color: 'bg-gray-100 text-gray-700' },
          ].map(({ label, href, color }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-4 py-3 text-sm font-semibold text-center transition-opacity hover:opacity-80 ${color}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
