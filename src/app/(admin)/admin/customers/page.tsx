'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import { Pagination, User } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface CustomerRow extends User {
  createdAt: string;
  _count: {
    orders: number;
    addresses: number;
    favorites: number;
    pickedOrders: number;
    drivenOrders: number;
  };
}

export default function AdminCustomersPage() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  const params = new URLSearchParams({
    role: 'CUSTOMER',
    page: String(page),
    limit: '20',
    ...(debounced && { q: debounced }),
  });

  const { data, isLoading } = useSWR<{ users: CustomerRow[]; pagination: Pagination }>(
    `/users?${params}`,
    fetcher
  );

  const customers = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.customers')}</h1>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : customers.length === 0 ? (
        <EmptyState title="No customers" />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Addresses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Favorites</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{c.name ?? '—'}</p>
                    <p className="text-xs font-mono text-gray-500">{c.mobile}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{c._count.orders}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{c._count.addresses}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{c._count.favorites}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/customers/${c.id}`} className="text-brand-600 text-xs font-semibold hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-gray-500">{pagination.total} customers</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
