'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { ProductImage } from '@/components/common/ProductImage';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Phone, MessageCircle, MapPin, RefreshCw, Banknote,
  ClipboardCheck, Truck, CheckCircle2, XCircle, AlertTriangle,
  Store, PackageCheck, Info,
} from 'lucide-react';
import api from '@/lib/api';
import { Order, OrderStatus, PaymentStatus, User, FulfillmentType } from '@/types';
import { formatPrice, orderStatusColor, timeAgo } from '@/lib/utils';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { LocationPreviewMap } from '@/components/maps/LocationPreviewMap';
import { FulfillmentBadge } from '@/components/common/FulfillmentBadge';
import { CarPickupDetails } from '@/components/common/CarPickupDetails';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PENDING:      'bg-gray-100 text-gray-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
};

// Per-item picking status badge (confirmed / not-available / replaced / …).
const ITEM_STATUS_BADGE: Record<string, { cls: string; key: string }> = {
  PENDING:     { cls: 'bg-amber-100 text-amber-700',   key: 'orders.itemPending' },
  PICKED:      { cls: 'bg-green-100 text-green-700',   key: 'orders.itemPicked' },
  UNAVAILABLE: { cls: 'bg-red-100 text-red-700',       key: 'orders.itemUnavailable' },
  REPLACED:    { cls: 'bg-violet-100 text-violet-700', key: 'orders.itemReplaced' },
  REMOVED:     { cls: 'bg-gray-200 text-gray-600',     key: 'orders.itemRemoved' },
};

const DELIVERY_STATUSES: OrderStatus[] = [
  'NEW',
  'PAYMENT_VERIFIED',
  'ASSIGNED_TO_PICKER',
  'PICKING_IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'ASSIGNED_TO_DRIVER',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
];

const PICKUP_STATUSES: OrderStatus[] = [
  'NEW',
  'PAYMENT_VERIFIED',
  'ASSIGNED_TO_PICKER',
  'PICKING_IN_PROGRESS',
  'READY_FOR_PICKUP',
  'PICKED_UP_BY_CUSTOMER',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
];

interface StatusHistoryRow {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

interface AdminOrder extends Order {
  pickerId?: string | null;
  driverId?: string | null;
  rejectionReason?: string | null;
  fulfillmentType: FulfillmentType;
  statusHistory: StatusHistoryRow[];
}

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading, mutate } = useSWR<AdminOrder>(
    `/orders/${id}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: usersData } = useSWR<{ users: User[] }>(
    '/users?role=PICKER&limit=100',
    fetcher
  );
  const { data: driverData } = useSWR<{ users: User[] }>(
    '/users?role=DRIVER&limit=100',
    fetcher
  );

  const pickers = usersData?.users ?? [];
  const drivers = driverData?.users ?? [];

  const [busy, setBusy] = useState<'picker' | 'driver' | 'status' | 'pay-approve' | 'pay-reject' | 'cancel' | null>(null);
  const [pickerId, setPickerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [statusValue, setStatusValue] = useState<OrderStatus | ''>('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showRejectPay, setShowRejectPay] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showDriverWarn, setShowDriverWarn] = useState(false);
  const [showCancelledAssign, setShowCancelledAssign] = useState(false);

  if (isLoading || !order) return <PageSpinner />;

  const customer = order.customer;

  // Group replacements under their original; flag orders with changed items.
  const itemById = new Map(order.items.map((i) => [i.id, i]));
  const replacementItemIds = new Set(
    order.items.map((i) => i.replacedByItemId).filter((v): v is string => Boolean(v)),
  );
  const topLevelItems = order.items.filter((i) => !replacementItemIds.has(i.id));
  const hasModifiedItems = order.items.some(
    (i) => i.status === 'REPLACED' || i.status === 'UNAVAILABLE',
  );
  // Cancelled/rejected orders cannot be assigned until an admin changes status.
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REJECTED';

  const renderItemRow = (
    it: (typeof order.items)[number],
    variant: 'original' | 'replacement' | 'plain',
  ) => {
    const productEntity = it.product ?? it.variant?.product ?? null;
    const productName = it.productName
      ? (locale === 'ar' && it.productNameAr ? it.productNameAr : it.productName)
      : productEntity
        ? pickLocalized(productEntity, locale)
        : '—';
    const sku = it.productSku ?? productEntity?.sku ?? it.variant?.sku ?? null;
    const st = (it.status ?? 'PENDING') as string;
    const badge = ITEM_STATUS_BADGE[st] ?? ITEM_STATUS_BADGE.PENDING;
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          <ProductImage src={productEntity?.imageUrl ?? null} alt={productName} fill sizes="48px" className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          {variant !== 'plain' && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {variant === 'replacement' ? t('orders.replacementLabel') : t('orders.originalLabel')}
            </p>
          )}
          <p className={`text-sm font-semibold text-gray-900 truncate ${st === 'REPLACED' ? 'line-through text-gray-500' : ''}`}>{productName}</p>
          <p className="text-xs text-gray-500 truncate">
            × {it.quantity}{sku ? ` · SKU ${sku}` : ''}{` · ${formatPrice(it.unitPrice)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>{t(badge.key)}</span>
          <p className="text-sm font-bold text-gray-900">{formatPrice(it.total)}</p>
        </div>
      </div>
    );
  };
  const handlePatch = async <T,>(
    label: typeof busy,
    fn: () => Promise<T>,
    success: string
  ) => {
    setBusy(label);
    try {
      await fn();
      await mutate();
      toast.success(success);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const assignPicker = () => {
    if (isCancelled) { setShowCancelledAssign(true); return; }
    if (!pickerId) return toast.error(t('admin.selectPicker'));
    handlePatch('picker',
      () => api.patch(`/orders/${order.id}/assign-picker`, { pickerId }),
      t('admin.assignPicker')
    );
  };

  const doAssignDriver = () => {
    handlePatch('driver',
      () => api.patch(`/orders/${order.id}/assign-driver`, { driverId }),
      t('admin.assignDriver')
    );
  };

  const assignDriver = () => {
    if (isCancelled) { setShowCancelledAssign(true); return; }
    if (!driverId) return toast.error(t('admin.selectDriver'));
    // Delivery orders with replaced / unavailable items require explicit
    // confirmation before a driver is dispatched.
    if (hasModifiedItems) { setShowDriverWarn(true); return; }
    doAssignDriver();
  };

  const updateStatus = () => {
    if (!statusValue) return toast.error(t('admin.selectStatus'));
    handlePatch('status',
      () => api.patch(`/orders/${order.id}/status`, { status: statusValue }),
      t('admin.manualStatusUpdate')
    );
  };

  const approvePayment = () => handlePatch('pay-approve',
    () => api.patch(`/orders/${order.id}/payment-verify`, { approved: true }),
    t('admin.approve')
  );

  const rejectPayment = () => handlePatch('pay-reject',
    () => api.patch(`/orders/${order.id}/payment-verify`, { approved: false, note: rejectNote.trim() || undefined }),
    t('admin.reject')
  ).then(() => { setShowRejectPay(false); setRejectNote(''); });

  const cancelOrder = () => {
    if (!cancelReason.trim()) return toast.error(t('admin.cancelReason'));
    handlePatch('cancel',
      () => api.patch(`/orders/${order.id}/reject`, { reason: cancelReason.trim() }),
      t('admin.cancelOrder')
    ).then(() => { setShowCancel(false); setCancelReason(''); });
  };

  const hasCoords = order.deliveryLat != null && order.deliveryLng != null;
  const deliveryLat = hasCoords ? Number(order.deliveryLat) : null;
  const deliveryLng = hasCoords ? Number(order.deliveryLng) : null;

  const isBankTransfer = order.paymentMethod === 'BANK_TRANSFER';
  const canVerifyPayment = isBankTransfer && order.paymentStatus === 'UNDER_REVIEW';
  const isPickup = order.fulfillmentType === 'PICKUP';
  const statusOptions = isPickup ? PICKUP_STATUSES : DELIVERY_STATUSES;
  const paymentLabel =
    order.paymentMethod === 'CASH_ON_DELIVERY' ? t('checkout.cashOnDelivery')
    : order.paymentMethod === 'BANK_TRANSFER'  ? t('checkout.bankTransfer')
    :                                            t('checkout.payAtBranch');

  return (
    <div className="space-y-5">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('admin.orders')}
      </Link>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left: order details */}
        <div className="space-y-5 xl:col-span-2">
          {/* Header */}
          <div className="rounded-2xl bg-white border border-gray-100 p-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{t('orders.order')}</p>
              <p className="font-mono text-lg font-bold text-gray-900">{order.orderNumber}</p>
              <div className="flex items-center gap-2">
                <FulfillmentBadge type={order.fulfillmentType} size="md" />
                <span className="text-xs text-gray-400">{timeAgo(order.createdAt)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`rounded-lg px-3 py-1 text-xs font-bold ${orderStatusColor(order.status)}`}>
                {t(`statuses.${order.status}`)}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYMENT_STATUS_COLOR[order.paymentStatus]}`}>
                {order.paymentStatus}
              </span>
              <span className="text-[11px] text-gray-500">{paymentLabel}</span>
            </div>
          </div>

          {/* Customer */}
          {customer && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
              <p className="font-semibold text-gray-900 text-sm">{t('admin.customer')}</p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{customer.name ?? '—'}</p>
                  <p className="text-xs text-gray-500 font-mono" dir="ltr">{customer.mobile}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`tel:${customer.mobile}`}
                    className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" /> {t('admin.callCustomer')}
                  </a>
                  <a
                    href={`https://wa.me/${customer.mobile.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {t('admin.whatsapp')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Pickup instructions (replaces delivery card for pickup orders) */}
          {isPickup && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-violet-600" />
                <p className="font-semibold text-violet-900 text-sm">{t('checkout.pickupSummary')}</p>
              </div>
              <p className="text-xs text-violet-800">{t('checkout.pickupOrderType')}</p>
              <p className="text-xs text-violet-800">{t('checkout.pickupPaymentNote')}</p>
              <div className="flex items-start gap-2 rounded-xl bg-white/70 border border-violet-100 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-800 leading-snug">{t('checkout.pickupInstructions')}</p>
              </div>
            </div>
          )}

          {/* Delivery eligibility summary (delivery orders) */}
          {!isPickup && (order.distanceKm != null || hasCoords) && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('delivery.distanceLabel')}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-gray-500">{t('delivery.distanceLabel')}</p>
                  <p className="font-semibold text-gray-900 font-mono">
                    {order.distanceKm != null ? `${Number(order.distanceKm).toFixed(2)} km` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">{t('admin.deliveryEligibility')}</p>
                  <p className="font-semibold text-gray-900">
                    {order.distanceKm != null ? t('admin.withinRange') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">{t('cart.delivery')}</p>
                  <p className="font-semibold text-gray-900">{formatPrice(order.deliveryFee)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">{t('admin.pricingRuleApplied')}</p>
                  <p className="font-semibold text-gray-900">
                    {order.subscriptionApplied
                      ? t('admin.ruleSubscription')
                      : Number(order.deliveryFee) === 0
                        ? t('admin.ruleThreshold')
                        : t('admin.ruleDistance')}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-[11px] text-gray-500">{t('admin.subscriptionApplied')}</p>
                <p className="font-semibold text-gray-900">
                  {order.subscriptionApplied ? t('admin.subscriptionApplied') : t('admin.subscriptionNotApplied')}
                </p>
              </div>
            </div>
          )}

          {/* Delivery */}
          {!isPickup && (order.address || hasCoords) && (
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
                    <p className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5 text-[11px] text-amber-800">
                      <span className="font-semibold">{t('checkout.deliveryNotesLabel')}:</span>{' '}
                      {order.address.deliveryNotes}
                    </p>
                  )}
                </div>
              )}
              {hasCoords && deliveryLat != null && deliveryLng != null && (
                <>
                  <LocationPreviewMap
                    lat={deliveryLat}
                    lng={deliveryLng}
                    language={locale === 'ar' ? 'ar' : 'en'}
                    height={220}
                    showDirections
                    showView
                  />
                  <p className="text-[11px] text-gray-400 font-mono">
                    {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}
                    {order.distanceKm && ` · ${Number(order.distanceKm).toFixed(1)} km away`}
                  </p>
                </>
              )}

              {/* Customer-provided location photos (read-only) */}
              {Array.isArray(order.deliveryImages) && order.deliveryImages.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500">{t('orders.deliveryImagesTitle')}</p>
                  <div className="flex flex-wrap gap-2">
                    {order.deliveryImages.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-20 w-20 overflow-hidden rounded-xl border border-gray-200 hover:opacity-90"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Car pickup details (read-only for admin) */}
          <CarPickupDetails order={order} mode="view" />

          {/* Items */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
            <p className="font-semibold text-gray-900 text-sm">{t('orders.items')} ({order.items.length})</p>
            {topLevelItems.map((item) => {
              const replacement = item.replacedByItemId ? itemById.get(item.replacedByItemId) : null;
              if (!replacement) return <div key={item.id}>{renderItemRow(item, 'plain')}</div>;
              return (
                <div key={item.id} className="overflow-hidden rounded-xl border border-gray-100">
                  <div className="p-3">{renderItemRow(item, 'original')}</div>
                  <div className="border-t border-dashed border-violet-200 bg-violet-50/50 p-3">
                    {renderItemRow(replacement, 'replacement')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          {(order.notes || order.replacementPreference) && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3 text-sm">
              {order.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('checkout.orderNotes')}</p>
                  <p className="text-gray-700 mt-0.5">{order.notes}</p>
                </div>
              )}
              {order.replacementPreference && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('checkout.replacementPreference')}</p>
                  <p className="text-gray-700 mt-0.5">{order.replacementPreference}</p>
                </div>
              )}
              {order.rejectionReason && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">{t('admin.cancelReason')}</p>
                  <p className="text-red-700 mt-0.5">{order.rejectionReason}</p>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>{t('cart.subtotal')}</span><span>{formatPrice(order.subtotal)}</span></div>
            {Number(order.discountTotal) > 0 && (
              <div className="flex justify-between text-green-600"><span>{t('cart.discount')}</span><span>-{formatPrice(order.discountTotal)}</span></div>
            )}
            {!isPickup && (
              <div className="flex justify-between text-gray-600"><span>{t('cart.delivery')}</span><span>{formatPrice(order.deliveryFee)}</span></div>
            )}
            <div className="flex justify-between border-t pt-2 font-bold text-gray-900">
              <span>{t('cart.total')}</span><span className="text-brand-600">{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Status history */}
          {order.statusHistory.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
              <p className="font-semibold text-gray-900 text-sm">{t('admin.statusHistory')}</p>
              <ol className="space-y-2">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 text-sm">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{t(`statuses.${h.status}`)}</p>
                      {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{timeAgo(h.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          {/* Payment verification */}
          {canVerifyPayment && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-amber-600" />
                <p className="font-semibold text-amber-800 text-sm">{t('admin.verifyBankTransfer')}</p>
              </div>
              {order.paymentProofUrl ? (
                <a
                  href={order.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-amber-200 bg-white"
                >
                  <img
                    src={order.paymentProofUrl}
                    alt={t('orders.uploadProof')}
                    className="max-h-56 w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <p className="px-3 py-1.5 text-xs text-amber-700 truncate">{order.paymentProofUrl}</p>
                </a>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-white border border-amber-100 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{t('admin.proofMissing')}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  loading={busy === 'pay-approve'}
                  onClick={approvePayment}
                  disabled={!order.paymentProofUrl}
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('admin.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === 'pay-reject'}
                  onClick={() => setShowRejectPay((v) => !v)}
                >
                  <XCircle className="h-4 w-4" /> {t('admin.reject')}
                </Button>
              </div>
              {showRejectPay && (
                <div className="space-y-2">
                  <Input
                    label={t('admin.cancelReason')}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <Button size="sm" variant="danger" className="w-full" loading={busy === 'pay-reject'} onClick={rejectPayment}>
                    {t('admin.reject')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Assign picker */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand-500" />
              <p className="font-semibold text-gray-900 text-sm">{t('admin.pickers')}</p>
            </div>
            <p className="text-xs text-gray-500">
              {order.picker?.name ?? '—'}
            </p>
            <select
              value={pickerId}
              onChange={(e) => setPickerId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">{t('admin.selectPicker')}</option>
              {pickers.map((p) => (
                <option key={p.id} value={p.id}>{p.name ?? p.mobile}</option>
              ))}
            </select>
            <Button size="sm" className="w-full" loading={busy === 'picker'} onClick={assignPicker}>
              {order.pickerId ? t('admin.reassignPicker') : t('admin.assignPicker')}
            </Button>
          </div>

          {/* Pickup quick actions */}
          {isPickup && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-violet-500" />
                <p className="font-semibold text-gray-900 text-sm">{t('checkout.pickupSummary')}</p>
              </div>
              {order.status === 'PICKING_IN_PROGRESS' && (
                <Button
                  size="sm"
                  className="w-full"
                  loading={busy === 'status'}
                  onClick={() =>
                    handlePatch('status',
                      () => api.patch(`/orders/${order.id}/status`, { status: 'READY_FOR_PICKUP' }),
                      t('admin.markReadyForPickup'),
                    )
                  }
                >
                  <PackageCheck className="h-4 w-4" /> {t('admin.markReadyForPickup')}
                </Button>
              )}
              {order.status === 'READY_FOR_PICKUP' && (
                <Button
                  size="sm"
                  className="w-full"
                  loading={busy === 'status'}
                  onClick={() =>
                    handlePatch('status',
                      () => api.patch(`/orders/${order.id}/status`, { status: 'PICKED_UP_BY_CUSTOMER' }),
                      t('admin.markPickedUp'),
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('admin.markPickedUp')}
                </Button>
              )}
              {order.status === 'PICKED_UP_BY_CUSTOMER' && (
                <Button
                  size="sm"
                  className="w-full"
                  loading={busy === 'status'}
                  onClick={() =>
                    handlePatch('status',
                      () => api.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' }),
                      t('admin.markCompleted'),
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('admin.markCompleted')}
                </Button>
              )}
            </div>
          )}

          {/* Assign driver (delivery only) */}
          {!isPickup ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand-500" />
                <p className="font-semibold text-gray-900 text-sm">{t('admin.drivers')}</p>
              </div>
              <p className="text-xs text-gray-500">
                {order.driver?.name ?? '—'}
              </p>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">{t('admin.selectDriver')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.mobile}</option>
                ))}
              </select>
              <Button size="sm" className="w-full" loading={busy === 'driver'} onClick={assignDriver}>
                {order.driverId ? t('admin.reassignDriver') : t('admin.assignDriver')}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <p className="font-semibold text-gray-500 text-sm">{t('admin.drivers')}</p>
              </div>
              <p className="text-xs text-gray-500">{t('admin.pickupDriverBlocked')}</p>
              <p className="text-[11px] text-gray-400">{t('admin.switchToDeliveryFirst')}</p>
            </div>
          )}

          {/* Manual status */}
          <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-500" />
              <p className="font-semibold text-gray-900 text-sm">{t('admin.manualStatusUpdate')}</p>
            </div>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as OrderStatus)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">{t('admin.selectStatus')}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{t(`statuses.${s}`)}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" className="w-full" loading={busy === 'status'} onClick={updateStatus}>
              {t('admin.manualStatusUpdate')}
            </Button>
          </div>

          {/* Cancel */}
          <div className="rounded-2xl bg-white border border-red-100 p-4 space-y-2">
            <p className="font-semibold text-red-700 text-sm">{t('admin.cancelOrder')}</p>
            {!showCancel ? (
              <Button
                size="sm"
                variant="danger"
                className="w-full"
                onClick={() => setShowCancel(true)}
                disabled={order.status === 'CANCELLED' || order.status === 'REJECTED'}
              >
                {t('admin.cancelOrder')}
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  label={t('admin.cancelReason')}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setShowCancel(false)}>
                    {t('common.back')}
                  </Button>
                  <Button size="sm" variant="danger" className="flex-1" loading={busy === 'cancel'} onClick={cancelOrder}>
                    {t('common.confirm')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Driver-assignment warning — order has replaced / unavailable items */}
      {showDriverWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDriverWarn(false)} />
          <div className="relative w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-gray-900">{t('admin.driverWarnTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600">{t('admin.driverWarnBody')}</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {order.items
                .filter((i) => i.status === 'REPLACED' || i.status === 'UNAVAILABLE')
                .map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1.5">
                    <span className="truncate text-gray-700">{i.productName ?? '—'}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${(ITEM_STATUS_BADGE[i.status as string] ?? ITEM_STATUS_BADGE.PENDING).cls}`}>
                      {t((ITEM_STATUS_BADGE[i.status as string] ?? ITEM_STATUS_BADGE.PENDING).key)}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDriverWarn(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1"
                loading={busy === 'driver'}
                onClick={() => { setShowDriverWarn(false); doAssignDriver(); }}
              >
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled order — cannot assign until status is changed */}
      {showCancelledAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancelledAssign(false)} />
          <div className="relative w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-bold text-gray-900">{t('admin.cancelledAssignTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600">{t('admin.cancelledAssignBody')}</p>
            <div className="pt-1">
              <Button className="w-full" onClick={() => setShowCancelledAssign(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
