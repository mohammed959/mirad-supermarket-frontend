'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Search, Power, KeyRound, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Pagination, Role, User } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo, cn } from '@/lib/utils';
import { CreateStaffDrawer } from './CreateStaffDrawer';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface StaffRow extends User {
  createdAt: string;
  _count: {
    orders: number;
    pickedOrders: number;
    drivenOrders: number;
    addresses: number;
    favorites: number;
  };
}

interface Props {
  role: Extract<Role, 'PICKER' | 'DRIVER'>;
  countLabel: string;
  countKey: 'pickedOrders' | 'drivenOrders';
}

export function StaffTable({ role, countLabel, countKey }: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const params = new URLSearchParams({
    role,
    page: String(page),
    limit: '20',
    ...(debounced && { q: debounced }),
  });

  const { data, isLoading, mutate } = useSWR<{ users: StaffRow[]; pagination: Pagination }>(
    `/users?${params}`,
    fetcher
  );

  const toggle = async (u: StaffRow) => {
    try {
      await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      await mutate();
      toast.success(`${u.username ?? u.name ?? u.email} ${!u.isActive ? t('staffMgmt.activated') : t('staffMgmt.deactivated')}`);
    } catch {
      toast.error(t('staffMgmt.updateFailed'));
    }
  };

  const resetPassword = async (u: StaffRow) => {
    const next = window.prompt(t('staffMgmt.newPasswordPrompt'));
    if (next === null) return;
    if (next.length < 8) { toast.error(t('staffMgmt.passwordMinLen')); return; }
    try {
      await api.patch(`/users/${u.id}/password`, { password: next });
      toast.success(t('staffMgmt.passwordUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('staffMgmt.updateFailed'));
    }
  };

  const staff = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('staffMgmt.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-9 pe-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {role === 'PICKER' ? t('staffMgmt.addPicker') : t('staffMgmt.addDriver')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : staff.length === 0 ? (
        <EmptyState title={role === 'PICKER' ? t('staffMgmt.noPickers') : t('staffMgmt.noDrivers')} />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('staffMgmt.person')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold text-gray-500 uppercase">{countLabel}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('staffMgmt.joined')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase">{t('staffMgmt.status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((u) => (
                <tr key={u.id} className={cn('hover:bg-gray-50', !u.isActive && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{u.username ?? u.name ?? '—'}</p>
                    <p className="text-xs font-mono text-gray-500" dir="ltr">{u.email ?? u.mobile ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-end font-semibold text-gray-900">
                    {u._count[countKey]}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {u.isActive ? t('staffMgmt.active') : t('staffMgmt.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => resetPassword(u)}
                        className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50"
                        aria-label={t('staffMgmt.resetPassword')}
                        title={t('staffMgmt.resetPassword')}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggle(u)}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                        aria-label={t('staffMgmt.toggleActive')}
                        title={t('staffMgmt.toggleActive')}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-gray-500">{pagination.total} {t('staffMgmt.total')}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t('common.previous')}</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CreateStaffDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => mutate()}
        role={role}
      />
    </div>
  );
}
