'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { ArrowLeft, AlertTriangle, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Customer Account Settings — profile editing reuses the existing
 * `PATCH /users/me` self-service endpoint (no new profile-update API was
 * added; see backend inspection notes). "Delete account" only links to the
 * dedicated confirmation screen — deletion itself never happens from here.
 */
export default function AccountSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isAuthenticated, fetchMe } = useCustomerAuthStore();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setNameAr(user.nameAr ?? '');
  }, [user]);

  if (!hydrated || !isAuthenticated || !user) {
    return <Skeleton className="h-64 w-full" />;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', {
        name: name.trim() || undefined,
        nameAr: nameAr.trim() || undefined,
      });
      await fetchMe();
      toast.success(t('account.profileUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('account.profileUpdated'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('account.settings')}</h1>
      </div>

      {/* Profile */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('account.profile')}</p>
        <Input
          label={t('account.mobileLabel')}
          value={user.mobile ?? ''}
          disabled
        />
        <p className="text-xs text-gray-400 -mt-2">{t('account.mobileReadonlyHint')}</p>
        <Input
          label={t('account.nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('account.nameArLabel')}
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          dir="rtl"
        />
        <Button className="w-full" loading={saving} onClick={handleSave}>
          {t('account.saveChanges')}
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <p className="font-semibold text-red-700">{t('account.dangerZone')}</p>
        </div>
        <Link
          href="/account/delete"
          className="flex items-center gap-3 rounded-xl bg-white border border-red-200 px-4 py-3 hover:bg-red-50/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-600">{t('account.deleteAccount')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('account.deleteAccountHint')}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-red-400 shrink-0 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
