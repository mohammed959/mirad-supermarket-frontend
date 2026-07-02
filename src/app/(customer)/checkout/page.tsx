'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useCartItemNames } from '@/hooks/useCartItemNames';
import {
  ShoppingBag, MapPin, Sparkles, AlertTriangle, ChevronRight,
  Truck, Store, Info, ShieldOff, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocationStore } from '@/stores/locationStore';
import { CustomerSubscription, Order, PaymentMethod, FulfillmentType } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineOtpLogin } from '@/components/customer/InlineOtpLogin';
import { PickupScheduler, type PickupSchedule } from '@/components/customer/PickupScheduler';
import { DeliveryImagesUploader } from '@/components/customer/DeliveryImagesUploader';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface MinimumOrder {
  enabled: boolean;
  minimumAmount: number | string;
}

interface DeliveryQuote {
  distanceKm: number | null;
  isWithinDeliveryRange: boolean;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  deliveryFee: number;
  matchedDistanceRule: {
    id: string;
    minKm: number;
    maxKm: number | null;
    fee: number;
    outOfService: boolean;
    basketThresholdApplied?: boolean;
    discountApplied?: boolean;
    discountAmount?: number;
  } | null;
  availableFulfillmentTypes: Array<'DELIVERY' | 'PICKUP'>;
  selectedFulfillmentType: 'DELIVERY' | 'PICKUP' | null;
  hasActiveSubscription: boolean;
  pricingRuleApplied: string;
  branchConfigured: boolean;
  maxDeliveryKm: number | null;
  reason: string;
  message?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const t = useTranslations();
  // Checkout is scoped to the customer auth store ONLY. A staff session that
  // happens to live in the same browser is invisible here.
  const isAuthenticated = useCustomerAuthStore((s) => s.isAuthenticated);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const clearCart = useCartStore((s) => s.clearCart);
  const nameFor = useCartItemNames(items);

  const locLabel = useLocationStore((s) => s.label);
  const locLine = useLocationStore((s) => s.addressLine);
  const locLat = useLocationStore((s) => s.latitude);
  const locLng = useLocationStore((s) => s.longitude);
  const locAddressId = useLocationStore((s) => s.addressId);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY');
  const [notes, setNotes] = useState('');
  const [replacementPref, setReplacementPref] = useState('');
  // Up to 3 delivery-location photos (Bunny CDN URLs) for the driver.
  const [deliveryImages, setDeliveryImages] = useState<string[]>([]);
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

  const { data: subscription } = useSWR<CustomerSubscription | null>(
    isAuthenticated ? '/subscriptions/my' : null,
    fetcher
  );

  const { data: minimum } = useSWR<MinimumOrder | null>('/delivery/minimum-order', fetcher);

  // Live delivery quote — single source of truth for distance, fee, and
  // available fulfillment types. We re-fetch whenever the location, subtotal,
  // selected fulfillment, or subscription changes.
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  useEffect(() => {
    if (!hydrated) {
      setQuote(null);
      return;
    }
    let active = true;
    api
      .post<{ data: DeliveryQuote }>('/checkout/calculate-delivery', {
        customerLatitude: locLat ?? null,
        customerLongitude: locLng ?? null,
        customerSubscriptionStatus: subscription?.status ?? 'NONE',
        selectedFulfillmentType: fulfillmentType,
        cartSubtotal: subtotal,
      })
      .then((res) => { if (active) setQuote(res.data.data); })
      .catch(() => { if (active) setQuote(null); });
    return () => { active = false; };
  }, [hydrated, locLat, locLng, subtotal, isAuthenticated, subscription, fulfillmentType]);

  // Honour the backend's verdict: if delivery isn't an available fulfillment
  // type, snap the customer over to pickup. The UI hides the tile too, but
  // we mustn't ship an order with a stale local selection either.
  const deliveryAvailable = Boolean(quote?.deliveryAvailable);
  const pickupAvailable = quote == null ? true : quote.pickupAvailable;
  useEffect(() => {
    if (quote && !deliveryAvailable && fulfillmentType === 'DELIVERY') {
      setFulfillmentType('PICKUP');
    }
  }, [quote, deliveryAvailable, fulfillmentType]);

  if (!hydrated) {
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

  const minimumAmount = minimum?.enabled ? Number(minimum.minimumAmount) : 0;
  const belowMinimum = minimumAmount > 0 && subtotal < minimumAmount;
  // Delivery fee is whatever the backend says — never a hardcoded fallback.
  // Pickup is always 0. If delivery isn't available, we don't display a fee row
  // at all (see the summary section below).
  const effectiveDeliveryFee = isPickup ? 0 : (quote?.deliveryFee ?? 0);
  const total = subtotal + effectiveDeliveryFee;
  const hasLocation = locLat !== null && locLng !== null;

  const scheduledIncomplete =
    isPickup &&
    pickupSchedule.pickupType === 'SCHEDULED' &&
    (!pickupSchedule.scheduledPickupDate || !pickupSchedule.scheduledPickupSlotId);

  const handlePlaceOrder = async () => {
    if (!isPickup && !hasLocation) {
      toast.error(t('checkout.chooseLocation'));
      return;
    }
    if (scheduledIncomplete) {
      toast.error(t('checkout.pickWindowRequired'));
      return;
    }
    if (belowMinimum) {
      toast.error(t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) }));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ data: Order }>('/orders', {
        fulfillmentType,
        addressId: isPickup ? undefined : locAddressId ?? undefined,
        deliveryLat: isPickup ? undefined : locLat ?? undefined,
        deliveryLng: isPickup ? undefined : locLng ?? undefined,
        deliveryImages: isPickup || deliveryImages.length === 0 ? undefined : deliveryImages,
        paymentMethod,
        notes: notes.trim() || undefined,
        replacementPreference: replacementPref.trim() || undefined,
        // Only send scheduled fields when the user actually picked a slot.
        ...(isPickup && pickupSchedule.pickupType === 'SCHEDULED' && {
          pickupType: 'SCHEDULED',
          scheduledPickupDate: pickupSchedule.scheduledPickupDate,
          scheduledPickupSlotId: pickupSchedule.scheduledPickupSlotId,
        }),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      const created = res.data.data;
      clearCart();
      toast.success(t('checkout.placeOrder'));
      router.push(`/orders/${created.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('checkout.placeOrder'));
    } finally {
      setLoading(false);
    }
  };

  const subBenefitLabel = (() => {
    // Phase 6: subscription benefit only applies when home delivery is
    // actually eligible. Max-distance gate has higher priority than
    // subscription, so an out-of-range subscriber sees no banner.
    if (!subscription || isPickup || !deliveryAvailable) return null;
    switch (subscription.plan.benefitType) {
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

      {!isAuthenticated && <InlineOtpLogin />}

      {/* Fulfillment selector */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('checkout.fulfillment')}</p>
        <div className="grid grid-cols-2 gap-2">
          {fulfillmentOptions.map(({ key, Icon, label, hint }) => {
            const active = fulfillmentType === key;
            const allowed = quote
              ? quote.availableFulfillmentTypes.includes(key)
              : true;
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
        {quote && !deliveryAvailable && hasLocation && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <ShieldOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-snug">
              <p className="font-semibold">{t('delivery.notAvailableTitle')}</p>
              <p className="mt-0.5 text-amber-700">
                {quote.message ?? t('delivery.notAvailableBody')}
              </p>
            </div>
          </div>
        )}
        {quote && deliveryAvailable && !isPickup && (
          <p className="flex items-center gap-1.5 rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-xs font-semibold text-green-700">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('delivery.availableForLocation')}
          </p>
        )}
        {quote && deliveryAvailable && !isPickup && quote.distanceKm != null && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-green-700 font-semibold">{t('delivery.withinCoverage')}</span>
              <span className="text-green-700 font-mono">
                {quote.distanceKm.toFixed(1)} km · {formatPrice(quote.deliveryFee)}
                {quote.matchedDistanceRule && (
                  <span className="ms-1 opacity-70">
                    ({quote.matchedDistanceRule.minKm}–{quote.matchedDistanceRule.maxKm ?? '∞'} km)
                  </span>
                )}
              </span>
            </div>
            {(quote.matchedDistanceRule?.basketThresholdApplied || quote.matchedDistanceRule?.discountApplied) && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {quote.matchedDistanceRule?.basketThresholdApplied && (
                  <span className="rounded-md bg-white/70 border border-green-200 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                    {t('delivery.basketThresholdApplied')}
                  </span>
                )}
                {quote.matchedDistanceRule?.discountApplied && quote.matchedDistanceRule.discountAmount != null && (
                  <span className="rounded-md bg-white/70 border border-green-200 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                    {t('delivery.discountApplied', { amount: formatPrice(quote.matchedDistanceRule.discountAmount) })}
                  </span>
                )}
              </div>
            )}
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
            <p className="font-semibold text-gray-900 truncate">{locLabel}</p>
            {locLine && <p className="text-xs text-gray-500 truncate">{locLine}</p>}
            {!hasLocation && (
              <p className="text-xs text-red-500 mt-0.5">{t('checkout.chooseLocation')}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 rtl:rotate-180" />
        </Link>
      )}

      {/* Delivery location photos (delivery only) — help the driver find the spot */}
      {!isPickup && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm space-y-3">
          <div>
            <p className="font-semibold text-gray-900">{t('checkout.deliveryImagesTitle')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('checkout.deliveryImagesHint')}</p>
          </div>
          <DeliveryImagesUploader value={deliveryImages} onChange={setDeliveryImages} />
        </div>
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
        <PickupScheduler value={pickupSchedule} onChange={setPickupSchedule} />
      )}

      {/* Subscription banner (delivery only) */}
      {subBenefitLabel && (
        <div className="flex items-center gap-3 rounded-2xl bg-violet-50 border border-violet-100 p-3">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <p className="text-sm text-violet-700 font-medium">{subBenefitLabel}</p>
        </div>
      )}

      {/* Minimum order warning */}
      {belowMinimum && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-semibold">
              {t('checkout.addMore', { amount: formatPrice(minimumAmount - subtotal) })}
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">
              {t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) })}
            </p>
          </div>
        </div>
      )}

      {/* Order items */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('checkout.orderItems')} ({items.length})</p>
        {items.map((item) => (
          <div key={item.productId} className="flex justify-between items-center text-sm">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{nameFor(item)}</p>
              <p className="text-xs text-gray-500">× {item.quantity}</p>
            </div>
            <p className="font-semibold text-gray-900 shrink-0 ms-3">
              {formatPrice(Number(item.price) * item.quantity)}
            </p>
          </div>
        ))}
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
          <span>{t('cart.subtotal')}</span><span>{formatPrice(subtotal)}</span>
        </div>
        {!isPickup && deliveryAvailable && (
          <div className="flex justify-between text-gray-600">
            <span>{t('cart.delivery')}</span>
            <span>
              {effectiveDeliveryFee === 0 ? (
                <span className="text-green-600 font-semibold">{t('common.free')}</span>
              ) : (
                formatPrice(effectiveDeliveryFee)
              )}
            </span>
          </div>
        )}
        {!isPickup && !deliveryAvailable && quote && (
          <div className="flex justify-between text-amber-700 text-xs">
            <span>{t('cart.delivery')}</span>
            <span className="font-semibold">{t('delivery.notAvailableShort')}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 font-bold text-gray-900">
          <span>{t('cart.total')}</span>
          <span className="text-brand-600">{formatPrice(total)}</span>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={loading}
        disabled={
          !isAuthenticated ||
          (!isPickup && !hasLocation) ||
          (!isPickup && !deliveryAvailable) ||
          belowMinimum ||
          (isPickup && !pickupAvailable) ||
          scheduledIncomplete
        }
        onClick={handlePlaceOrder}
      >
        {!isAuthenticated
          ? t('auth.signInToContinue')
          : !isPickup && !hasLocation
            ? t('checkout.chooseLocation')
            : !isPickup && !deliveryAvailable
              ? t('delivery.notAvailableShort')
              : scheduledIncomplete
                ? t('checkout.pickWindowRequired')
                : belowMinimum
                  ? t('checkout.addMore', { amount: formatPrice(minimumAmount - subtotal) })
                  : `${t('checkout.placeOrder')} · ${formatPrice(total)}`}
      </Button>
    </div>
  );
}
