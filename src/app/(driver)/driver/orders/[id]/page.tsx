'use client';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Phone, Navigation, MapPin, StickyNote, CheckCircle2, X, Lock, Ban } from 'lucide-react';
import api from '@/lib/api';
import { ProductImage } from '@/components/common/ProductImage';
import { Order } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { LocationPreviewMap } from '@/components/maps/LocationPreviewMap';
import { buildDirectionsUrl } from '@/lib/maps';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function DriverOrderPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading, mutate } = useSWR<Order>(`/orders/${id}`, fetcher);
  const [loading, setLoading] = useState(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);

  const updateStatus = async (status: string) => {
    setLoading(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      await mutate();
      toast.success(t('common.save'));
      if (status === 'DELIVERED') router.push('/driver');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('common.save'));
    } finally {
      setLoading(false);
    }
  };

  const confirmReceived = async () => {
    setLoading(true);
    try {
      await api.patch(`/orders/${id}/confirm-received`);
      await mutate();
      toast.success(t('driver.productsConfirmed'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('common.save'));
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !order) return <PageSpinner />;

  // The journey is "started" once the order is out for delivery. Map and
  // navigation stay locked before that (backend also withholds the coords).
  const journeyStarted = order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED';
  const hasCoords = order.deliveryLat != null && order.deliveryLng != null;
  const deliveryLat = hasCoords ? Number(order.deliveryLat) : null;
  const deliveryLng = hasCoords ? Number(order.deliveryLng) : null;
  const navUrl = journeyStarted && hasCoords && deliveryLat != null && deliveryLng != null
    ? buildDirectionsUrl(deliveryLat, deliveryLng)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4 max-w-lg mx-auto">
      <Link href="/driver" className="flex items-center gap-1.5 text-sm text-gray-500">
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </Link>

      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono font-bold text-gray-900">{order.orderNumber}</p>
          <span className="rounded-xl bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
            {t(`statuses.${order.status}`)}
          </span>
        </div>

        {order.customer && (
          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{order.customer.name ?? '—'}</p>
              <p className="text-xs text-gray-500 font-mono" dir="ltr">{order.customer.mobile}</p>
            </div>
            <a href={`tel:${order.customer.mobile}`}>
              <Button variant="secondary" size="sm">
                <Phone className="h-4 w-4" />
                {t('driver.callCustomer')}
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Cancelled order — driver can no longer act on it */}
      {(order.status === 'CANCELLED' || order.status === 'REJECTED') && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <Ban className="h-5 w-5 shrink-0" />
          {t('driver.orderCancelled')}
        </div>
      )}

      {/* Address + delivery notes */}
      {(order.address || hasCoords) && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-gray-900 text-sm">{t('orders.deliveryDetails')}</p>
          </div>
          {order.address && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800">{order.address.label}</p>
              {order.address.addressLine && (
                <p className="text-xs text-gray-500">{order.address.addressLine}</p>
              )}
              {order.address.city && <p className="text-xs text-gray-500">{order.address.city}</p>}
              {order.address.deliveryNotes && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <StickyNote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-snug">
                    <span className="font-semibold">{t('checkout.deliveryNotesLabel')}:</span>{' '}
                    {order.address.deliveryNotes}
                  </p>
                </div>
              )}
            </div>
          )}
          {journeyStarted ? (
            hasCoords && deliveryLat != null && deliveryLng != null && (
              <LocationPreviewMap
                lat={deliveryLat}
                lng={deliveryLng}
                language={locale === 'ar' ? 'ar' : 'en'}
                height={240}
                showDirections={false}
                showView
              />
            )
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-xs text-gray-500">
              <Lock className="h-4 w-4 shrink-0 text-gray-400" />
              {t('driver.locationLockedUntilStart')}
            </div>
          )}
        </div>
      )}

      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-500 p-4 text-white shadow-lg shadow-brand-200 hover:bg-brand-600 active:scale-95 transition-all"
        >
          <Navigation className="h-6 w-6" />
          <p className="font-bold">{t('driver.navigate')}</p>
        </a>
      )}

      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('orders.items')} ({order.items.length})</p>
        {order.items.map((item) => {
          const productEntity = item.product ?? item.variant?.product ?? null;
          const name = item.productName
            ? (locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName)
            : productEntity
              ? pickLocalized(productEntity, locale)
              : '—';
          const sku = item.productSku ?? productEntity?.sku ?? null;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                <ProductImage src={productEntity?.imageUrl ?? null} alt={name} fill sizes="56px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  × {item.quantity}{sku ? ` · SKU ${sku}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 shrink-0 ms-2">{formatPrice(item.total)}</p>
            </div>
          );
        })}
        <div className="border-t pt-2 flex justify-between font-bold text-sm">
          <span>{t('cart.total')}</span>
          <span className="text-brand-600">{formatPrice(order.total)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {order.status === 'ASSIGNED_TO_DRIVER' && (
          <>
            {/* Step 2 — confirm products received (required before journey) */}
            {order.driverConfirmedAt ? (
              <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-3 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {t('driver.productsConfirmed')}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <p className="text-sm text-gray-700">{t('driver.confirmReceivedStatement')}</p>
                <Button className="w-full" loading={loading} onClick={confirmReceived}>
                  <CheckCircle2 className="h-4 w-4" /> {t('driver.confirmReceived')}
                </Button>
              </div>
            )}

            {/* Step 3 — start journey (locked until confirmed) */}
            <Button
              className="w-full"
              size="lg"
              loading={loading}
              disabled={!order.driverConfirmedAt}
              onClick={() => updateStatus('OUT_FOR_DELIVERY')}
            >
              {t('driver.startJourney')}
            </Button>
            {!order.driverConfirmedAt && (
              <p className="text-center text-xs text-gray-400">{t('driver.confirmFirst')}</p>
            )}
          </>
        )}
        {/* Step 4 — complete delivery */}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <Button className="w-full" size="lg" onClick={() => setShowDeliverConfirm(true)}>
            {t('driver.markDelivered')}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showDeliverConfirm && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setShowDeliverConfirm(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-white p-5 shadow-sheet"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />

              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50">
                    <CheckCircle2 className="h-5 w-5 text-success-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{t('driver.confirmDeliveryTitle')}</h2>
                </div>
                <button
                  onClick={() => setShowDeliverConfirm(false)}
                  disabled={loading}
                  aria-label={t('common.close')}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {t('driver.confirmDeliveryBody', { orderNumber: order.orderNumber })}
              </p>

              <div className="rounded-2xl bg-gray-50 p-3 mb-4 space-y-1.5">
                {order.customer && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t('admin.customer')}</span>
                    <span className="font-semibold text-gray-900">{order.customer.name ?? order.customer.mobile}</span>
                  </div>
                )}
                {order.address?.label && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t('orders.deliveryDetails')}</span>
                    <span className="font-semibold text-gray-900">{order.address.label}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t('cart.total')}</span>
                  <span className="font-bold text-brand-600">{formatPrice(order.total)}</span>
                </div>
                {order.paymentMethod === 'CASH_ON_DELIVERY' && (
                  <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-800">
                    {t('driver.collectCashWarning', { amount: formatPrice(order.total) })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowDeliverConfirm(false)}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  loading={loading}
                  onClick={async () => {
                    await updateStatus('DELIVERED');
                    setShowDeliverConfirm(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('driver.confirmDeliveryAction')}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
