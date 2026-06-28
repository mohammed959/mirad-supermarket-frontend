'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Plus, ToggleLeft, ToggleRight, Pencil, Archive, Percent } from 'lucide-react';
import api from '@/lib/api';
import { Pagination, Promotion, PromotionType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PromotionDrawer } from '@/components/admin/PromotionDrawer';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const TYPE_LABEL: Record<PromotionType, string> = {
  BUY_X_GET_Y:                 'Buy X get Y',
  VARIANT_DISCOUNT:            'Variant discount',
  PRODUCT_DISCOUNT:            'Product discount',
  CATEGORY_DISCOUNT:           'Category discount',
  FREE_DELIVERY_THRESHOLD:     'Free delivery',
  SUBSCRIPTION_BASED_DISCOUNT: 'Subscription',
};

const TYPE_COLOR: Record<PromotionType, string> = {
  BUY_X_GET_Y:                 'bg-violet-100 text-violet-700',
  VARIANT_DISCOUNT:            'bg-blue-100 text-blue-700',
  PRODUCT_DISCOUNT:            'bg-brand-100 text-brand-700',
  CATEGORY_DISCOUNT:           'bg-amber-100 text-amber-700',
  FREE_DELIVERY_THRESHOLD:     'bg-green-100 text-green-700',
  SUBSCRIPTION_BASED_DISCOUNT: 'bg-pink-100 text-pink-700',
};

function describeConfig(p: Promotion): string {
  const cfg = (p.config as any) ?? {};
  switch (p.type) {
    case 'PRODUCT_DISCOUNT':
    case 'CATEGORY_DISCOUNT':
    case 'VARIANT_DISCOUNT':
    case 'SUBSCRIPTION_BASED_DISCOUNT':
      if (cfg.mode === 'fixed') return `${cfg.value ?? 0} SAR off`;
      return `${cfg.value ?? 0}% off`;
    case 'BUY_X_GET_Y':
      return `Buy ${cfg.buyQuantity ?? 0} get ${cfg.getQuantity ?? 0}`;
    default:
      return '';
  }
}

export default function AdminPromotionsPage() {
  const t = useTranslations();
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (filter === 'active') params.set('active', 'true');
  if (filter === 'inactive') params.set('active', 'false');

  const { data, isLoading, mutate } = useSWR<{ promotions: Promotion[]; pagination: Pagination }>(
    `/promotions?${params}`,
    fetcher
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (p: Promotion) => { setEditing(p); setDrawerOpen(true); };

  const toggle = async (p: Promotion) => {
    try {
      await api.patch(`/promotions/${p.id}/status`, { isActive: !p.isActive });
      await mutate();
      toast.success(`Promotion ${!p.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update');
    }
  };

  const archive = async (p: Promotion) => {
    if (!confirm(`Archive "${p.name}"? This deactivates and hides it from the active list.`)) return;
    try {
      await api.patch(`/promotions/${p.id}/archive`);
      await mutate();
      toast.success('Archived');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const promotions = data?.promotions ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.promotions')}</h1>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New promotion
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
              filter === f
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : promotions.length === 0 ? (
        <EmptyState
          title="No promotions"
          description="Create your first promotion — discounts auto-apply at checkout."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New promotion</Button>}
        />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Promotion</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mechanic</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Used</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promotions.map((p) => (
                <tr key={p.id} className={cn('hover:bg-gray-50', !p.isActive && 'opacity-70')}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500" dir="rtl">{p.nameAr}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TYPE_COLOR[p.type])}>
                      {TYPE_LABEL[p.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Percent className="h-3.5 w-3.5 text-brand-400" /> {describeConfig(p)}
                    </div>
                    {p.targetScope !== 'ALL' && (
                      <p className="text-[10px] text-gray-400 mt-0.5">scope: {p.targetScope.toLowerCase()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(p.startDate).toLocaleDateString()}
                    {' → '}
                    {p.endDate ? new Date(p.endDate).toLocaleDateString() : '∞'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className="font-semibold text-gray-900">{p.usageCount}</span>
                    {p.usageLimit && <span className="text-gray-400"> / {p.usageLimit}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggle(p)}
                        className={cn(
                          'rounded-md p-1.5 transition-colors',
                          p.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                        )}
                        aria-label="Toggle active"
                      >
                        {p.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => archive(p)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-gray-500">{pagination.total} promotions</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <PromotionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={() => mutate()}
        promotion={editing}
      />
    </div>
  );
}
