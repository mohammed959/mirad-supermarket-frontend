'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { ProductImage } from '@/components/common/ProductImage';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Phone, MapPin, RotateCcw, Banknote, MessageSquare, Truck,
  AlertTriangle, X, Store, Info, ScanLine, CalendarClock,
} from 'lucide-react';
import { OrderBarcode } from '@/components/common/OrderBarcode';
import { CarPickupDetails } from '@/components/common/CarPickupDetails';
import api from '@/lib/api';
import { Order, ReorderResult, PaymentStatus } from '@/types';
import { formatPrice, orderStatusColor } from '@/lib/utils';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { OrderStatusTimeline } from '@/components/customer/OrderStatusTimeline';
import { DeliveryImagesUploader } from '@/components/customer/DeliveryImagesUploader';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { LocationPreviewMap } from '@/components/maps/LocationPreviewMap';
import { FulfillmentBadge } from '@/components/common/FulfillmentBadge';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PENDING:      'bg-gray-100 text-gray-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
};

export default function OrderDetailPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, mutate } = useSWR<Order>(`/orders/${id}`, fetcher, { refreshInterval: 15000 });

  const setItemsFromReorder = useCartStore((s) => s.setItemsFromReorder);
  const openCart = useCartStore((s) => s.openCart);
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Delivery-location photos, editable any time so the driver sees the latest.
  const [locImages, setLocImages] = useState<string[]>([]);
  useEffect(() => {
    setLocImages(order?.deliveryImages ?? []);
  }, [order?.deliveryImages]);

  const persistImages = async (next: string[]) => {
    setLocImages(next);
    try {
      await api.patch(`/orders/${id}/delivery-images`, { images: next });
      await mutate();
      toast.success(t('orders.imagesUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('checkout.imageUploadFailed'));
    }
  };

  if (isLoading) return <PageSpinner />;
  if (!order) return <div className="text-center py-16 text-gray-500">{t('orders.noOrders')}</div>;

  const isBankTransfer = order.paymentMethod === 'BANK_TRANSFER';
  const needsProof = isBankTransfer && !order.paymentProofUrl;
  const driverMobile = order.driver?.mobile;
  const isPickup = order.fulfillmentType === 'PICKUP';

  // Cancellable until the driver starts the journey (everything before
  // OUT_FOR_DELIVERY) — mirrors CUSTOMER_CANCELLABLE on the backend.
  const CANCELLABLE: typeof order.status[] = [
    'NEW', 'PAYMENT_VERIFIED', 'ASSIGNED_TO_PICKER', 'PICKING_IN_PROGRESS',
    'READY_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DRIVER',
  ];
  const canCancel = CANCELLABLE.includes(order.status);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/orders/${order.id}/cancel`, { reason: cancelReason.trim() || undefined });
      await mutate();
      toast.success(t('orders.cancelled'));
      setShowCancel(false);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('orders.cancelNotAllowed'));
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    try {
      const res = await api.post<{ data: ReorderResult }>(`/orders/${order.id}/reorder`);
      const { items, skipped } = res.data.data;
      if (items.length === 0) {
        toast.error(t('orders.buyAgainEmpty'));
        return;
      }
      setItemsFromReorder(
        items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          productNameAr: i.productNameAr,
          productImage: i.productImage,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      toast.success(t('orders.reorder'));
      openCart();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('orders.reorder'));
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('orders.myOrders')}
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-white border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 mb-0.5">{t('orders.order')}</p>
            <p className="font-mono font-bold text-gray-900">{order.orderNumber}</p>
            <FulfillmentBadge type={order.fulfillmentType} />
          </div>
          <span className={`rounded-xl px-3 py-1 text-xs font-bold shrink-0 ${orderStatusColor(order.status)}`}>
            {t(`statuses.${order.status}`)}
          </span>
        </div>
        <OrderStatusTimeline status={order.status} fulfillmentType={order.fulfillmentType} className="mt-5" />
      </div>

      {/* Pickup instructions */}
      {isPickup && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-violet-600" />
            <p className="font-semibold text-violet-900">{t('checkout.pickupSummary')}</p>
          </div>
          <p className="text-xs text-violet-800">{t('checkout.pickupOrderType')}</p>
          <p className="text-xs text-violet-800">{t('checkout.pickupPaymentNote')}</p>
          <div className="flex items-start gap-2 rounded-xl bg-white/70 border border-violet-100 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-violet-800 leading-snug">{t('checkout.pickupInstructions')}</p>
          </div>
        </div>
      )}

      {/* Scheduled pickup card */}
      {isPickup && order.pickupType === 'SCHEDULED' && order.scheduledPickupDate && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-brand-600" />
            <p className="font-semibold text-brand-900">{t('orders.scheduledPickup')}</p>
          </div>
          <p className="text-sm text-brand-800">
            {t('orders.scheduledPickupBody', {
              date: new Date(order.scheduledPickupDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              }),
              start: order.scheduledPickupStartTime ?? '',
              end: order.scheduledPickupEndTime ?? '',
            })}
          </p>
        </div>
      )}

      {/* Optional curbside car-pickup info — only for pickup orders still in flight. */}
      <CarPickupDetails order={order} mode="edit" onUpdated={() => mutate()} />

      {/* Pickup barcode — prominent for pickup orders, also available for delivery
          so customers can quote it when collecting failed deliveries from branch. */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-brand-500" />
          <p className="font-semibold text-gray-900">{t('orders.barcodeTitle')}</p>
        </div>
        <p className="text-xs text-gray-500">{t('orders.barcodeDescription')}</p>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-4">
          <OrderBarcode orderNumber={order.orderNumber} width={320} height={96} />
        </div>
      </section>

      {/* Bank transfer prompt */}
      {needsProof && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <Banknote className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{t('orders.actionRequired')}</p>
            <p className="text-xs text-amber-700 mt-0.5 mb-2">{t('orders.actionRequiredBody')}</p>
            <Button size="sm" onClick={() => router.push(`/orders/${order.id}/payment`)}>
              {t('orders.uploadProof')}
            </Button>
          </div>
        </div>
      )}

      {isBankTransfer && order.paymentProofUrl && order.paymentStatus !== 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">{t('orders.proofUnderReview')}</p>
        </div>
      )}

      {/* Driver contact */}
      {order.driver && (
        <div className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <Truck className="h-5 w-5 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{t('admin.drivers')}</p>
            <p className="font-semibold text-gray-900 truncate">{order.driver.name ?? '—'}</p>
          </div>
          {driverMobile && (
            <a
              href={`tel:${driverMobile}`}
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" /> {t('orders.callDriver')}
            </a>
          )}
        </div>
      )}

      {/* Delivery details (delivery orders only) */}
      {!isPickup && (order.address || order.deliveryLat) && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-gray-900">{t('orders.deliveryDetails')}</p>
          </div>
          {order.address && (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800">{order.address.label}</p>
              {order.address.addressLine && (
                <p className="text-xs text-gray-500">{order.address.addressLine}</p>
              )}
              {order.address.city && (
                <p className="text-xs text-gray-500">{order.address.city}</p>
              )}
              {order.address.deliveryNotes && (
                <p className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5 text-[11px] text-amber-800">
                  <span className="font-semibold">{t('checkout.deliveryNotesLabel')}:</span>{' '}
                  {order.address.deliveryNotes}
                </p>
              )}
            </div>
          )}
          {order.deliveryLat != null && order.deliveryLng != null && (
            <LocationPreviewMap
              lat={Number(order.deliveryLat)}
              lng={Number(order.deliveryLng)}
              language="en"
              height={200}
              showView
            />
          )}
        </div>
      )}

      {/* Delivery location photos — editable any time (delivery orders only) */}
      {!isPickup && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-gray-900">{t('orders.deliveryImagesTitle')}</p>
          </div>
          <p className="text-xs text-gray-500">{t('orders.deliveryImagesHint')}</p>
          <DeliveryImagesUploader value={locImages} onChange={persistImages} />
        </div>
      )}

      {/* Notes & replacement preference */}
      {(order.notes || order.replacementPreference) && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
          {order.notes && (
            <div className="flex gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-500">{t('checkout.orderNotes')}</p>
                <p className="text-sm text-gray-700 mt-0.5">{order.notes}</p>
              </div>
            </div>
          )}
          {order.replacementPreference && (
            <div className="flex gap-2">
              <RotateCcw className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-500">{t('checkout.replacementPreference')}</p>
                <p className="text-sm text-gray-700 mt-0.5">{order.replacementPreference}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('orders.items')} ({order.items.length})</p>
        {order.items.map((item) => {
          // Phase 6: prefer the flat product field; fall back to the
          // legacy variant.product so orders placed before the migration
          // still render. `productName` snapshot on the line itself wins
          // when the source product has been renamed or deleted.
          const productEntity = item.product ?? item.variant?.product ?? null;
          const productName = item.productName
            ? (locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName)
            : productEntity
              ? pickLocalized(productEntity, locale)
              : '—';
          const productImage = productEntity?.imageUrl ?? null;
          const sku = item.productSku ?? productEntity?.sku ?? item.variant?.sku ?? null;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                <ProductImage
                  src={productImage}
                  alt={productName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{productName}</p>
                <p className="text-xs text-gray-500">
                  × {item.quantity}{sku ? ` · SKU ${sku}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 shrink-0">{formatPrice(item.total)}</p>
            </div>
          );
        })}
      </div>

      {/* Payment */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">{t('checkout.paymentMethod')}</p>
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYMENT_STATUS_COLOR[order.paymentStatus]}`}>
            {order.paymentStatus}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {order.paymentMethod === 'CASH_ON_DELIVERY' ? t('checkout.cashOnDelivery')
            : order.paymentMethod === 'BANK_TRANSFER' ? t('checkout.bankTransfer')
              : t('checkout.payAtBranch')}
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2 text-sm">
        <p className="font-semibold text-gray-900 mb-1">{t('orders.summary')}</p>
        <div className="flex justify-between text-gray-600">
          <span>{t('cart.subtotal')}</span><span>{formatPrice(order.subtotal)}</span>
        </div>
        {Number(order.discountTotal) > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{t('cart.discount')}</span><span>-{formatPrice(order.discountTotal)}</span>
          </div>
        )}
        {/* Delivery fee row — pickup orders have no delivery fee, so hide it entirely */}
        {!isPickup && (
          <div className="flex justify-between text-gray-600">
            <span>{t('cart.delivery')}</span>
            <span>
              {Number(order.deliveryFee) === 0 ? (
                <span className="text-green-600 font-semibold">{t('common.free')}</span>
              ) : (
                formatPrice(order.deliveryFee)
              )}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 font-bold text-gray-900">
          <span>{t('cart.total')}</span>
          <span className="text-brand-600">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Reorder */}
      <Button
        className="w-full"
        variant="outline"
        loading={reordering}
        onClick={handleReorder}
      >
        <RotateCcw className="h-4 w-4" /> {t('orders.reorder')}
      </Button>

      {/* Cancel — only available while the order is still in the warehouse */}
      {canCancel && (
        <div className="rounded-2xl border border-danger-100 bg-white p-4 space-y-2">
          {!showCancel ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setShowCancel(true)}
            >
              <X className="h-4 w-4" /> {t('orders.cancelOrder')}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">{t('orders.cancelConfirm')}</p>
              <Input
                label={t('orders.cancelReason')}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder=""
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={cancelling}
                  onClick={() => { setShowCancel(false); setCancelReason(''); }}
                >
                  {t('common.back')}
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={cancelling}
                  onClick={handleCancel}
                >
                  {t('common.confirm')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
