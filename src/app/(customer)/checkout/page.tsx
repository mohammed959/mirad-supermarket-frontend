'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  ShoppingBag, MapPin, Sparkles, AlertTriangle, ChevronRight,
  Truck, Store, Info, ShieldOff, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocationStore } from '@/stores/locationStore';
import { Order, PaymentMethod, FulfillmentType } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickupScheduler, type PickupSchedule, type PublicSettings } from '@/components/customer/PickupScheduler';
import { useLocale } from '@/i18n/useLocale';

// ── Unified checkout-preparation response (`POST /checkout/prepare`) ──
// This is the ONLY source of truth for address verification, localized
// product names, current prices/availability, subtotal, delivery fee,
// subscription benefit, minimum-order status, available fulfillment
// types, pickup settings, total, and blockers. Nothing here is
// calculated, decided, or re-derived on the client.
interface CheckoutBlocker {
  code: string;
  message: string;
  productId?: string;
}

interface CheckoutPreviewItem {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
}

interface CheckoutPreviewAddress {
  id: string;
  label: string;
  addressLine: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  deliveryNotes: string | null;
}

interface CheckoutPrepareResponse {
  checkoutSessionId: string;
  expiresAt: string;
  address: CheckoutPreviewAddress | null;
  items: CheckoutPreviewItem[];
  pricing: { subtotal: number; deliveryFee: number; subscriptionDiscount: number; total: number };
  minimumOrder: { enabled: boolean; minimumAmount: number; satisfied: boolean };
  delivery: {
    distanceKm: number | null;
    withinCoverage: boolean;
    available: boolean;
    pricingRuleApplied: string;
  };
  fulfillment: {
    selected: FulfillmentType;
    availableTypes: FulfillmentType[];
    pickupSettings: PublicSettings | null;
  };
  subscriptionBenefit: { applied: boolean; type: string | null };
  blockers: CheckoutBlocker[];
}

// Blocker codes that already get a dedicated, purpose-built notice
// elsewhere on the page — the generic "review issues" list below only
// shows whatever isn't already covered by those.
const BLOCKERS_WITH_DEDICATED_UI = new Set(['MINIMUM_ORDER_NOT_MET', 'OUTSIDE_COVERAGE', 'FULFILLMENT_UNAVAILABLE']);

export default function CheckoutPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  // Checkout is scoped to the customer auth store ONLY. A staff session that
  // happens to live in the same browser is invisible here.
  const isAuthenticated = useCustomerAuthStore((s) => s.isAuthenticated);
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const locLabel = useLocationStore((s) => s.label);
  const locLine = useLocationStore((s) => s.addressLine);
  const locLat = useLocationStore((s) => s.latitude);
  const locLng = useLocationStore((s) => s.longitude);
  const locAddressId = useLocationStore((s) => s.addressId);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Checkout is customer-only — a logged-out visitor never reaches the
  // form (same hard-redirect pattern as /cart, /orders, /favorites).
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY');
  const [notes, setNotes] = useState('');
  const [replacementPref, setReplacementPref] = useState('');
  const [loading, setLoading] = useState(false);
  // Pickup scheduling — defaults to ASAP. Becomes SCHEDULED when the customer
  // picks a future date/slot from the PickupScheduler.
  const [pickupSchedule, setPickupSchedule] = useState<PickupSchedule>({ pickupType: 'ASAP' });

  const isPickup = fulfillmentType === 'PICKUP';
  // Payment method is fully derived from the fulfillment choice — the customer
  // no longer picks it explicitly. Pickup ⇒ Pay at branch; delivery ⇒ COD.
  const paymentMethod: PaymentMethod = isPickup ? 'PAY_AT_BRANCH' : 'CASH_ON_DELIVERY';

  // Reset schedule when switching away from pickup.
  useEffect(() => {
    if (!isPickup && pickupSchedule.pickupType !== 'ASAP') {
      setPickupSchedule({ pickupType: 'ASAP' });
    }
  }, [isPickup, pickupSchedule.pickupType]);

  // ── POST /checkout/prepare — the single unified checkout call ─────
  // Replaces the previous direct calls to /subscriptions/my,
  // /delivery/minimum-order, /checkout/calculate-delivery, /products?ids=
  // and /pickup/public-settings. Re-run whenever the selected address,
  // cart items/quantities, selected fulfillment type, or UI language changes.
  const itemsKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.quantity}`).sort().join(','),
    [items],
  );

  const [preview, setPreview] = useState<CheckoutPrepareResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const prepareRequestId = useRef(0);

  const runPrepare = useCallback(async (): Promise<CheckoutPrepareResponse | null> => {
    const requestId = ++prepareRequestId.current;
    setPreparing(true);
    setPrepareError(null);
    try {
      const res = await api.post<{ data: CheckoutPrepareResponse }>('/checkout/prepare', {
        lang: locale,
        addressId: locAddressId ?? undefined,
        selectedFulfillmentType: fulfillmentType,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      if (prepareRequestId.current !== requestId) return null;
      setPreview(res.data.data);
      return res.data.data;
    } catch (err: any) {
      if (prepareRequestId.current === requestId) {
        setPreview(null);
        setPrepareError(err.response?.data?.message ?? t('checkout.prepareFailed'));
      }
      return null;
    } finally {
      if (prepareRequestId.current === requestId) setPreparing(false);
    }
    // itemsKey mirrors `items` content for change-detection (same pattern as
    // useCartItemNames' idsKey) — `items` itself is read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, locAddressId, fulfillmentType, itemsKey, t]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || items.length === 0) {
      setPreview(null);
      return;
    }
    runPrepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated, locAddressId, itemsKey, fulfillmentType, locale]);

  // Honour the backend's verdict: if delivery isn't an available fulfillment
  // type, snap the customer over to pickup. The UI hides the tile too, but
  // we mustn't ship an order with a stale local selection either.
  const availableTypes = preview?.fulfillment.availableTypes ?? null;
  const deliveryAvailable = availableTypes ? availableTypes.includes('DELIVERY') : true;
  useEffect(() => {
    if (availableTypes && !deliveryAvailable && fulfillmentType === 'DELIVERY') {
      setFulfillmentType('PICKUP');
    }
  }, [availableTypes, deliveryAvailable, fulfillmentType]);

  if (!hydrated || !isAuthenticated) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ShoppingBag className="h-12 w-12 text-brand-400" />
        <p className="font-semibold text-gray-700">{t('cart.empty')}</p>
        <Link href="/">
          <Button variant="outline">{t('cart.startShopping')}</Button>
        </Link>
      </div>
    );
  }

  const hasLocation = locLat !== null && locLng !== null;
  const blockers = preview?.blockers ?? [];
  const hasBlockers = blockers.length > 0;
  const otherBlockers = blockers.filter((b) => !BLOCKERS_WITH_DEDICATED_UI.has(b.code));
  const deliveryBlocker = blockers.find((b) => b.code === 'OUTSIDE_COVERAGE' || b.code === 'FULFILLMENT_UNAVAILABLE');

  const scheduledIncomplete =
    isPickup &&
    pickupSchedule.pickupType === 'SCHEDULED' &&
    (!pickupSchedule.scheduledPickupDate || !pickupSchedule.scheduledPickupSlotId);

  const previewItemById = new Map(preview?.items.map((i) => [i.productId, i]) ?? []);

  const handlePlaceOrder = async () => {
    // Prevent duplicate submissions (double-tap / slow network).
    if (loading) return;
    if (!preview) {
      toast.error(prepareError ?? t('checkout.prepareFailed'));
      return;
    }
    if (hasBlockers) {
      toast.error(blockers[0].message);
      return;
    }
    if (scheduledIncomplete) {
      toast.error(t('checkout.pickWindowRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ data: Order }>('/orders', {
        checkoutSessionId: preview.checkoutSessionId,
        // Required by the order-creation endpoint alongside the checkout
        // session — derived from the fulfillment choice, never a raw
        // customer-supplied price/fee/coverage value.
        paymentMethod,
        notes: notes.trim() || undefined,
        replacementPreference: replacementPref.trim() || undefined,
        pickupType: isPickup && pickupSchedule.pickupType === 'SCHEDULED' ? 'SCHEDULED' : null,
        scheduledPickupDate:
          isPickup && pickupSchedule.pickupType === 'SCHEDULED' ? pickupSchedule.scheduledPickupDate ?? null : null,
        scheduledPickupSlotId:
          isPickup && pickupSchedule.pickupType === 'SCHEDULED' ? pickupSchedule.scheduledPickupSlotId ?? null : null,
      });
      const created = res.data.data;
      clearCart();
      toast.success(t('checkout.placeOrder'));
      router.push(`/orders/${created.id}`);
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.code === 'CHECKOUT_CHANGED') {
        toast.error(t('checkout.detailsChanged'));
        await runPrepare();
        return;
      }
      toast.error(err.response?.data?.message ?? t('checkout.placeOrder'));
    } finally {
      setLoading(false);
    }
  };

  const subBenefitLabel = (() => {
    if (!preview || isPickup || !preview.subscriptionBenefit.applied) return null;
    switch (preview.subscriptionBenefit.type) {
      case 'FREE_DELIVERY':       return t('checkout.subscriptionFree');
      case 'DISCOUNTED_DELIVERY': return t('checkout.subscriptionDiscounted');
      case 'CAPPED_DELIVERY':     return t('checkout.subscriptionCapped');
      default:                    return t('subscriptions.title');
    }
  })();

  const fulfillmentOptions: Array<{
    key: FulfillmentType;
    Icon: typeof Truck;
    label: string;
    hint: string;
  }> = [
    { key: 'DELIVERY', Icon: Truck,  label: t('checkout.delivery'), hint: t('checkout.deliveryHint') },
    { key: 'PICKUP',   Icon: Store,  label: t('checkout.pickup'),   hint: t('checkout.pickupHint') },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-xl font-bold text-gray-900">{t('checkout.title')}</h1>

      {prepareError && !preview && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">
          {prepareError}
        </div>
      )}

      {/* Fulfillment selector */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('checkout.fulfillment')}</p>
        <div className="grid grid-cols-2 gap-2">
          {fulfillmentOptions.map(({ key, Icon, label, hint }) => {
            const active = fulfillmentType === key;
            const allowed = availableTypes ? availableTypes.includes(key) : true;
            const disabled = !allowed;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setFulfillmentType(key)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-2xl border p-3 text-start transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-brand-200',
                  disabled && 'opacity-60 cursor-not-allowed hover:border-gray-200'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl',
                    active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-[11px] text-gray-500 leading-snug">{hint}</p>
              </button>
            );
          })}
        </div>
        {preview && !isPickup && !preview.delivery.available && hasLocation && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <ShieldOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-snug">
              <p className="font-semibold">{t('delivery.notAvailableTitle')}</p>
              <p className="mt-0.5 text-amber-700">
                {deliveryBlocker?.message ?? t('delivery.notAvailableBody')}
              </p>
            </div>
          </div>
        )}
        {preview && !isPickup && preview.delivery.available && (
          <p className="flex items-center gap-1.5 rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-xs font-semibold text-green-700">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('delivery.availableForLocation')}
          </p>
        )}
        {preview && !isPickup && preview.delivery.available && preview.delivery.distanceKm != null && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-green-700 font-semibold">{t('delivery.withinCoverage')}</span>
              <span className="text-green-700 font-mono">
                {preview.delivery.distanceKm.toFixed(1)} km · {formatPrice(preview.pricing.deliveryFee)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delivery location (only for delivery) */}
      {!isPickup && (
        <Link
          href="/checkout/location"
          className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <MapPin className="h-5 w-5 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{t('nav.deliverTo')}</p>
            <p className="font-semibold text-gray-900 truncate">{preview?.address?.label ?? locLabel}</p>
            {(preview?.address?.addressLine ?? locLine) && (
              <p className="text-xs text-gray-500 truncate">{preview?.address?.addressLine ?? locLine}</p>
            )}
            {!hasLocation && (
              <p className="text-xs text-red-500 mt-0.5">{t('checkout.chooseLocation')}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 rtl:rotate-180" />
        </Link>
      )}

      {/* Pickup summary box */}
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

      {/* Pickup scheduler (silently hidden when admin has disabled the feature). */}
      {isPickup && (
        <PickupScheduler
          value={pickupSchedule}
          onChange={setPickupSchedule}
          settings={preview?.fulfillment.pickupSettings}
        />
      )}

      {/* Subscription banner (delivery only) */}
      {subBenefitLabel && (
        <div className="flex items-center gap-3 rounded-2xl bg-violet-50 border border-violet-100 p-3">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <p className="text-sm text-violet-700 font-medium">{subBenefitLabel}</p>
        </div>
      )}

      {/* Minimum order warning */}
      {preview && !preview.minimumOrder.satisfied && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-semibold">
              {t('checkout.addMore', {
                amount: formatPrice(Math.max(0, preview.minimumOrder.minimumAmount - preview.pricing.subtotal)),
              })}
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">
              {t('checkout.minimumOrder', { amount: formatPrice(preview.minimumOrder.minimumAmount) })}
            </p>
          </div>
        </div>
      )}

      {/* Order items */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('checkout.orderItems')} ({items.length})</p>
        {items.map((item) => {
          const live = previewItemById.get(item.productId);
          const name = live?.name ?? (locale === 'ar' && item.productNameAr ? item.productNameAr : item.productName);
          const unitPrice = live?.unitPrice ?? Number(item.price);
          const lineTotal = live?.lineTotal ?? unitPrice * item.quantity;
          const unavailable = live ? !live.available : false;
          return (
            <div key={item.productId} className="flex justify-between items-center text-sm">
              <div className="min-w-0">
                <p className={cn('font-medium truncate', unavailable ? 'text-red-500 line-through' : 'text-gray-800')}>
                  {name}
                </p>
                <p className="text-xs text-gray-500">× {item.quantity}</p>
              </div>
              <p className="font-semibold text-gray-900 shrink-0 ms-3">{formatPrice(lineTotal)}</p>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">{t('checkout.orderNotes')}</label>
          <textarea
            placeholder={t('checkout.orderNotesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">{t('checkout.replacementPreference')}</label>
          <textarea
            placeholder={t('checkout.replacementPlaceholder')}
            value={replacementPref}
            onChange={(e) => setReplacementPref(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>{t('cart.subtotal')}</span>
          <span>{preview ? formatPrice(preview.pricing.subtotal) : '—'}</span>
        </div>
        {!isPickup && preview?.delivery.available && (
          <div className="flex justify-between text-gray-600">
            <span>{t('checkout.deliveryCostLabel')}</span>
            <span>
              {preview.pricing.deliveryFee === 0 ? (
                <span className="text-green-600 font-semibold">{t('checkout.deliveryFreeWord')}</span>
              ) : (
                formatPrice(preview.pricing.deliveryFee)
              )}
            </span>
          </div>
        )}
        {!isPickup && preview && !preview.delivery.available && (
          <div className="flex justify-between text-amber-700 text-xs">
            <span>{t('checkout.deliveryCostLabel')}</span>
            <span className="font-semibold">{t('delivery.notAvailableShort')}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 font-bold text-gray-900">
          <span>{t('cart.total')}</span>
          <span className="text-brand-600">{preview ? formatPrice(preview.pricing.total) : '—'}</span>
        </div>
      </div>

      {/* Any remaining checkout blocker not already surfaced above (invalid
          address, insufficient stock, unavailable product, empty cart…) —
          always shown clearly, in the backend's own words. */}
      {otherBlockers.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-3 space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t('checkout.reviewIssues')}
          </p>
          <ul className="space-y-1">
            {otherBlockers.map((b, idx) => (
              <li key={`${b.code}-${b.productId ?? idx}`} className="text-xs text-red-600">
                {b.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        loading={loading}
        disabled={loading || preparing || !preview || hasBlockers || scheduledIncomplete}
        onClick={handlePlaceOrder}
      >
        {!preview
          ? (preparing ? t('common.loading') : (prepareError ?? t('checkout.prepareFailed')))
          : hasBlockers
            ? blockers[0].message
            : scheduledIncomplete
              ? t('checkout.pickWindowRequired')
              : `${t('checkout.placeOrder')} · ${formatPrice(preview.pricing.total)}`}
      </Button>
    </div>
  );
}
