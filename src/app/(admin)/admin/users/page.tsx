'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { User, Role, Pagination } from '@/types';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';
import { CreateUserDrawer } from '@/components/admin/CreateUserDrawer';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const ROLE_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Customers', value: 'CUSTOMER' },
  { label: 'Pickers', value: 'PICKER' },
  { label: 'Drivers', value: 'DRIVER' },
  { label: 'Admins', value: 'SUPER_ADMIN' },
];

const ROLE_COLORS: Record<Role, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  PICKER: 'bg-yellow-100 text-yellow-700',
  DRIVER: 'bg-green-100 text-green-700',
};

export default function AdminUsersPage() {
  const t = useTranslations();
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), ...(roleFilter && { role: roleFilter }) });
  const { data, isLoading, mutate } = useSWR<{ users: User[]; pagination: Pagination }>(
    `/users?${params}`,
    fetcher
  );

  const users = data?.users ?? [];

  const setRole = async (id: string, role: Role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      await mutate();
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.allUsers')}</h1>
        <Button
          size="sm"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus className="h-4 w-4" /> Add user
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setRoleFilter(f.value); setPage(1); }}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
              roleFilter === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-gray-800">{user.mobile}</td>
                  <td className="px-4 py-3 text-gray-700">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role]}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo((user as any).createdAt)}</td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue={user.role}
                      onChange={(e) => setRole(user.id, e.target.value as Role)}
                      className="rounded-lg border border-gray-200 py-1 px-2 text-xs text-gray-700 focus:border-brand-400 focus:outline-none"
                    >
                      {(['CUSTOMER', 'PICKER', 'DRIVER', 'SUPER_ADMIN'] as Role[]).map((r) => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => mutate()}
        initialRole={(roleFilter || 'CUSTOMER') as Role}
      />
    </div>
  );
}
