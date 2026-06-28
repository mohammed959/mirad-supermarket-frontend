'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, CheckCircle2, Clock, Users, UserMinus, X,
} from 'lucide-react';
import api from '@/lib/api';
import { SubscriptionPlan, Pagination } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SubscriptionPlanDrawer } from '@/components/admin/SubscriptionPlanDrawer';
import { formatPrice, cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

type Tab = 'plans' | 'subscribers';
type SubStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

interface AdminPlan extends SubscriptionPlan {
  isActive?: boolean;
  activeSubscriberCount?: number;
}

interface SubscriberRow {
  id: string;
  status: SubStatus;
  startDate: string;
  expiryDate: string;
  paymentMethod: string;
  deliveriesUsed: number;
  createdAt: string;
  customer: { id: string; name: string | null; mobile: string };
  plan: { id: string; name: string; benefitType: string; durationDays: number };
}

const STATUS_COLOR: Record<SubStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  ACTIVE:          'bg-green-100 text-green-700',
  EXPIRED:         'bg-gray-100 text-gray-700',
  CANCELLED:       'bg-red-100 text-red-700',
};

const BENEFIT_LABEL: Record<string, string> = {
  FREE_DELIVERY:       'Free delivery',
  DISCOUNTED_DELIVERY: 'Discounted',
  CAPPED_DELIVERY:     'Capped fee',
};

export default function AdminSubscriptionsPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>('plans');
  // Lifted state so the Plans tab can switch to Subscribers tab pre-
  // filtered to a specific plan.
  const [planFilter, setPlanFilter] = useState<string>('');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.subscriptions')}</h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['plans', 'subscribers'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            )}
          >
            {key === 'plans' ? 'Plans' : 'Subscribers'}
          </button>
        ))}
      </div>

      {tab === 'plans' ? (
        <PlansTab
          onViewSubscribers={(planId) => {
            setPlanFilter(planId);
            setTab('subscribers');
          }}
        />
      ) : (
        <SubscribersTab
          planFilter={planFilter}
          onClearPlanFilter={() => setPlanFilter('')}
        />
      )}
    </div>
  );
}

function PlansTab({ onViewSubscribers }: { onViewSubscribers: (planId: string) => void }) {
  const { data, isLoading, mutate } = useSWR<AdminPlan[]>(
    '/subscriptions/admin/plans',
    fetcher
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit   = (p: SubscriptionPlan) => { setEditing(p); setDrawerOpen(true); };

  const toggle = async (p: AdminPlan) => {
    try {
      await api.patch(`/subscriptions/admin/plans/${p.id}/status`, {
        isActive: !(p.isActive ?? true),
      });
      await mutate();
      toast.success('Plan updated');
    } catch (err: any) {
      // The backend's gate (subscribers still on the plan) surfaces via
      // err.response.data.message — show that verbatim so the admin knows
      // exactly how many subscribers they have to remove first.
      toast.error(err.response?.data?.message ?? 'Failed to update plan');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add plan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No plans" description="Create your first delivery subscription plan." />
      ) : (
        <div className="space-y-2">
          {data.map((p) => {
            const isActive = p.isActive ?? true;
            const activeCount = p.activeSubscriberCount ?? 0;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border bg-white p-4',
                  isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500" dir="rtl">{p.nameAr}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-semibold text-brand-600">{formatPrice(p.price)}</span>
                    <span>· {p.durationDays} days</span>
                    <span>· {BENEFIT_LABEL[p.benefitType] ?? p.benefitType}</span>
                    {p.discountValue != null && <span>· -{formatPrice(p.discountValue)} off</span>}
                    {p.cappedFee != null && <span>· cap {formatPrice(p.cappedFee)}</span>}
                    {p.maxFreeDeliveries != null && <span>· max {p.maxFreeDeliveries}</span>}
                  </div>
                </div>

                {/* Subscriber count — clickable when > 0, opens the
                    Subscribers tab pre-filtered to this plan. */}
                <button
                  type="button"
                  onClick={() => onViewSubscribers(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    activeCount > 0
                      ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                      : 'bg-gray-100 text-gray-500',
                  )}
                  title="View subscribers on this plan"
                >
                  <Users className="h-3.5 w-3.5" />
                  {activeCount} subscriber{activeCount === 1 ? '' : 's'}
                </button>

                <button
                  onClick={() => toggle(p)}
                  className={cn(
                    'flex items-center gap-1 text-xs font-semibold',
                    isActive ? 'text-green-600' : 'text-gray-400'
                  )}
                >
                  {isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  aria-label="Edit"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SubscriptionPlanDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={() => mutate()}
        plan={editing}
      />
    </div>
  );
}

function SubscribersTab({
  planFilter,
  onClearPlanFilter,
}: {
  planFilter: string;
  onClearPlanFilter: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<SubStatus | ''>('');
  const [page, setPage] = useState(1);
  const [confirmingCancel, setConfirmingCancel] = useState<SubscriberRow | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Default to ACTIVE filter when a plan filter is set, so the admin
  // immediately sees the customers blocking the plan deactivation.
  const effectiveStatus: SubStatus | '' =
    statusFilter || (planFilter ? 'ACTIVE' : '');

  const params = new URLSearchParams({
    page: String(page),
    ...(effectiveStatus && { status: effectiveStatus }),
    ...(planFilter && { planId: planFilter }),
  });
  const { data, isLoading, mutate } = useSWR<{ subscriptions: SubscriberRow[]; pagination: Pagination }>(
    `/subscriptions/admin/subscribers?${params}`,
    fetcher
  );

  const confirm = async (id: string) => {
    try {
      await api.patch(`/subscriptions/admin/${id}/confirm`);
      await mutate();
      toast.success('Subscription activated');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to confirm');
    }
  };

  const cancel = async (sub: SubscriberRow) => {
    setCancellingId(sub.id);
    try {
      await api.delete(`/subscriptions/admin/${sub.id}`);
      await mutate();
      toast.success(`${sub.customer.name ?? sub.customer.mobile} removed from ${sub.plan.name}`);
      setConfirmingCancel(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to remove subscriber');
    } finally {
      setCancellingId(null);
    }
  };

  const subs = data?.subscriptions ?? [];
  const pagination = data?.pagination;
  // The plan name comes from the first subscriber's plan field, which is
  // populated by the backend's include.
  const filteredPlanName = planFilter && subs.length > 0 ? subs[0].plan.name : null;

  return (
    <div className="space-y-4">
      {/* Plan-filter chip — visible only when filtering to one plan */}
      {planFilter && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
          <Users className="h-4 w-4 text-brand-500" />
          <span className="text-brand-800 font-semibold">
            Showing subscribers on plan{filteredPlanName ? `: ${filteredPlanName}` : ''}
          </span>
          <button
            type="button"
            onClick={() => { onClearPlanFilter(); setPage(1); }}
            className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatusFilter(s as SubStatus | ''); setPage(1); }}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
              effectiveStatus === s
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            )}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : subs.length === 0 ? (
        <EmptyState title="No subscribers" />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Started</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subs.map((s) => {
                const isRemovable = s.status === 'ACTIVE' || s.status === 'PENDING_PAYMENT';
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{s.customer.name ?? '—'}</p>
                      <p className="text-xs font-mono text-gray-500">{s.customer.mobile}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.plan.name}
                      <p className="text-[10px] text-gray-400">{BENEFIT_LABEL[s.plan.benefitType] ?? s.plan.benefitType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold', STATUS_COLOR[s.status])}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.expiryDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {s.status === 'PENDING_PAYMENT' && (
                          <Button size="sm" onClick={() => confirm(s.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Confirm
                          </Button>
                        )}
                        {s.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" /> {s.deliveriesUsed} used
                          </span>
                        )}
                        {isRemovable && (
                          <button
                            type="button"
                            onClick={() => setConfirmingCancel(s)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            title="Remove customer from plan"
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-gray-500">{pagination.total} subscriptions</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal — required step before cancelling */}
      {confirmingCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Remove subscriber?</h3>
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold">
                  {confirmingCancel.customer.name ?? confirmingCancel.customer.mobile}
                </span>{' '}
                will be removed from <strong>{confirmingCancel.plan.name}</strong>. Their
                subscription will be cancelled immediately and they will stop receiving the
                plan&apos;s delivery benefit.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                This action is logged. The customer can re-subscribe later if the plan is
                still active.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={Boolean(cancellingId)}
                onClick={() => setConfirmingCancel(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 focus:ring-red-100"
                loading={cancellingId === confirmingCancel.id}
                onClick={() => cancel(confirmingCancel)}
              >
                Remove subscriber
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
