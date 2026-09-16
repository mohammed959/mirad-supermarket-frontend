'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ShieldAlert, XCircle } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Delete Account confirmation. A dedicated screen (not a modal triggered
 * from a single tap) plus a required "I understand" checkbox that gates the
 * final destructive button — two deliberate steps beyond navigating here,
 * so deletion can never happen from one accidental tap.
 *
 * On success: `deleteAccount()` (customerAuthStore) already clears the
 * token and customer-specific local state (cart, favorites, cached
 * profile) — this screen only has to redirect afterwards.
 */
export default function DeleteAccountPage() {
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated, deleteAccount } = useCustomerAuthStore();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!hydrated || !isAuthenticated) {
    return <Skeleton className="h-64 w-full" />;
  }

  const handleDelete = async () => {
    // Guards against a duplicate tap firing a second request while the
    // first is still in flight.
    if (deleting || !understood) return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success(t('account.deleteSuccess'));
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('account.deleteFailed'));
      setDeleting(false);
    }
  };

  const consequences = [
    t('account.deleteConsequenceAccessEnds'),
    t('account.deleteConsequenceCannotRestore'),
    t('account.deleteConsequenceNewAccount'),
    t('account.deleteConsequenceNoHistory'),
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          disabled={deleting}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('account.deleteAccountTitle')}</h1>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <p className="font-semibold text-red-700">{t('account.deleteAccountIntro')}</p>
        </div>
        <ul className="space-y-2">
          {consequences.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-white border border-gray-200 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          disabled={deleting}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-400"
        />
        <span className="text-sm text-gray-800">{t('account.deleteConfirmCheckbox')}</span>
      </label>

      <Button
        variant="danger"
        className="w-full"
        size="lg"
        loading={deleting}
        disabled={!understood || deleting}
        onClick={handleDelete}
      >
        {deleting ? t('account.deletingInProgress') : t('account.deleteConfirmButton')}
      </Button>

      <Button
        variant="ghost"
        className="w-full"
        disabled={deleting}
        onClick={() => router.push('/account/settings')}
      >
        {t('account.deleteCancel')}
      </Button>
    </div>
  );
}
