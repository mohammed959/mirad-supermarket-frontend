'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Banknote, CheckCircle2, Clock } from 'lucide-react';
import api from '@/lib/api';
import { Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPrice } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function OrderPaymentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading, mutate } = useSWR<Order>(`/orders/${params.id}?lang=${locale}`, fetcher);

  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.paymentProofUrl) setProofUrl(data.paymentProofUrl);
  }, [data?.paymentProofUrl]);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (data.paymentMethod !== 'BANK_TRANSFER') {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center py-12">
        <p className="font-semibold text-gray-700">{t('orders.paymentApproved')}</p>
        <Button onClick={() => router.push(`/orders/${data.id}`)}>{t('orders.trackOrder')}</Button>
      </div>
    );
  }

  const alreadyApproved = data.paymentStatus === 'APPROVED';

  const handleSubmit = async () => {
    if (!proofUrl.trim()) {
      toast.error(t('validation.required'));
      return;
    }
    if (!/^https?:\/\//i.test(proofUrl.trim())) {
      toast.error(t('validation.required'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/orders/${data.id}/payment-proof`, { proofUrl: proofUrl.trim() });
      await mutate();
      toast.success(t('orders.proofUnderReview'));
      router.push(`/orders/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('orders.uploadProof'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <button
        type="button"
        onClick={() => router.push(`/orders/${data.id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('checkout.bankTransfer')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('orders.order')} <span className="font-mono font-semibold">#{data.orderNumber}</span> — {t('cart.total').toLowerCase()}{' '}
          <span className="font-semibold text-brand-600">{formatPrice(data.total)}</span>
        </p>
      </div>

      {/* Bank details placeholder */}
      <section className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-brand-500" />
          <h2 className="font-semibold text-gray-900">{t('checkout.bankTransfer')}</h2>
        </div>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-gray-500">Bank</dt><dd className="font-medium text-gray-900">Al Rajhi Bank</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Account name</dt><dd className="font-medium text-gray-900">{t('common.appName')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">IBAN</dt><dd className="font-mono font-medium text-gray-900">SA00 0000 0000 0000 0000</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">{t('cart.total')}</dt><dd className="font-bold text-brand-600">{formatPrice(data.total)}</dd></div>
        </dl>
        <p className="text-xs text-gray-400">
          #{data.orderNumber}
        </p>
      </section>

      {/* Status */}
      {alreadyApproved ? (
        <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-100 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-700">{t('orders.paymentApproved')}</p>
        </div>
      ) : data.paymentStatus === 'UNDER_REVIEW' && data.paymentProofUrl ? (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">{t('orders.proofUnderReview')}</p>
          </div>
        </div>
      ) : null}

      {/* Proof upload */}
      {!alreadyApproved && (
        <section className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">{t('orders.uploadProof')}</h2>
          <Input
            label={t('orders.uploadProof')}
            placeholder="https://example.com/my-receipt.jpg"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <Button className="w-full" loading={submitting} onClick={handleSubmit}>
            {t('orders.uploadProof')}
          </Button>
        </section>
      )}
    </div>
  );
}
