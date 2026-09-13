'use client';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Sparkles, Truck, Wallet, ChevronDown, X, Check, Clock, AlertTriangle,
  Banknote, BadgePercent,
} from 'lucide-react';
import api from '@/lib/api';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocationStore } from '@/stores/locationStore';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { CustomerSubscription, SubscriptionPlan } from '@/types';
import { MapPin, ShieldOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { InlineOtpLogin } from '@/components/customer/InlineOtpLogin';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatPrice, cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

type Pay = 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';

function benefitLine(plan: SubscriptionPlan, t: ReturnType<typeof useTranslations>): string {
  switch (plan.benefitType) {
    case 'FREE_DELIVERY':
      return t('subscriptions.freeDelivery');
    case 'DISCOUNTED_DELIVERY':
      return t('subscriptions.discountedDelivery', { amount: formatPrice(plan.discountValue ?? 0) });
    case 'CAPPED_DELIVERY':
      return t('subscriptions.cappedDelivery', { amount: formatPrice(plan.cappedFee ?? 0) });
    default:
      return '';
  }
}

export default function SubscriptionsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const isAuth = useCustomerAuthStore((s) => s.isAuthenticated);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { data: plans, isLoading } = useSWR<SubscriptionPlan[]>(`/subscriptions/plans?lang=${locale}`, fetcher);
  const { data: mySub, mutate: refreshSub } = useSWR<CustomerSubscription | null>(
    isAuth ? `/subscriptions/my?lang=${locale}` : null,
    fetcher
  );

  // Distance-gated subscription availability — pulls the customer's stored
  // location and asks the backend whether they're within max delivery distance.
  const locLat = useLocationStore((s) => s.latitude);
  const locLng = useLocationStore((s) => s.longitude);
  const eligibilityKey =
    hydrated && locLat != null && locLng != null
      ? `/subscriptions/eligibility?lat=${locLat}&lng=${locLng}`
      : hydrated
        ? '/subscriptions/eligibility'
        : null;
  const { data: eligibility } = useSWR<{
    eligible: boolean;
    hasLocation: boolean;
    distanceKm: number | null;
    maxDeliveryKm: number | null;
    branchConfigured: boolean;
    message?: string;
  }>(eligibilityKey, fetcher);

  const outOfCoverage = Boolean(eligibility && !eligibility.eligible && eligibility.hasLocation);
  const needsLocation = Boolean(eligibility && !eligibility.eligible && !eligibility.hasLocation);

  const sorted = useMemo(() => {
    if (!plans) return [];
    return [...plans].sort((a, b) => Number(a.price) - Number(b.price));
  }, [plans]);

  // Heuristic: the longest-duration plan is the "Recommended"
  const recommendedId = useMemo(() => {
    if (!sorted.length) return null;
    return sorted.reduce((best, p) => (p.durationDays > best.durationDays ? p : best), sorted[0]).id;
  }, [sorted]);

  const [pickerPlan, setPickerPlan] = useState<SubscriptionPlan | null>(null);
  const [payMethod, setPayMethod] = useState<Pay>('CASH_ON_DELIVERY');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const goToPlans = () => {
    const el = document.getElementById('plans');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openSubscribe = (plan: SubscriptionPlan) => {
    if (!isAuth) {
      toast(t('auth.signInToContinue'));
      return;
    }
    if (outOfCoverage) {
      toast.error(t('subscriptions.outsideCoverageBody'));
      return;
    }
    if (needsLocation) {
      toast(t('subscriptions.needLocationBody'));
      return;
    }
    setPickerPlan(plan);
    setPayMethod('CASH_ON_DELIVERY');
  };

  const confirmSubscribe = async () => {
    if (!pickerPlan) return;
    setSubmitting(true);
    try {
      await api.post('/subscriptions/subscribe', {
        planId: pickerPlan.id,
        paymentMethod: payMethod,
        // Pass the location so the server can refuse if we're outside coverage
        // — and so a customer subscribing without a saved address still gets
        // gated correctly.
        customerLat: locLat ?? undefined,
        customerLng: locLng ?? undefined,
      });
      await refreshSub();
      toast.success(t('subscriptions.current'));
      setPickerPlan(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('subscriptions.subscribeNow'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      await api.delete('/subscriptions/cancel');
      await refreshSub();
      toast.success(t('subscriptions.cancelCurrent'));
      setShowCancel(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t('subscriptions.cancelCurrent'));
    } finally {
      setCancelling(false);
    }
  };

  const FAQ = [
    { q: t('subscriptions.faqQ1'), a: t('subscriptions.faqA1') },
    { q: t('subscriptions.faqQ2'), a: t('subscriptions.faqA2') },
    { q: t('subscriptions.faqQ3'), a: t('subscriptions.faqA3') },
    { q: t('subscriptions.faqQ4'), a: t('subscriptions.faqA4') },
  ];

  const hasActiveOrPending = mySub && (mySub.status === 'ACTIVE' || mySub.status === 'PENDING_PAYMENT');

  return (
    // Break out of the parent's px-4/py-4 so the hero can paint full-width.
    <div className="-mx-4 -my-4 bg-gray-50 pb-32 md:pb-12 min-h-screen">

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 px-5 pt-8 pb-12 text-white">
        <div className="absolute -end-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -start-10 -bottom-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
            <Crown className="h-3 w-3" /> {t('admin.subscriptions')}
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black leading-tight max-w-md">
            {t('subscriptions.heroTitle')}
          </h1>
          <p className="mt-2 text-sm text-white/85 max-w-md">
            {t('subscriptions.heroSubtitle')}
          </p>
        </div>
      </section>

      <div className="px-4 -mt-6 space-y-5">

        {/* ACTIVE / PENDING / EXPIRED block */}
        {hydrated && isAuth && mySub && (
          <ActiveSubscriptionCard
            sub={mySub}
            t={t}
            locale={locale}
            onCancel={() => setShowCancel(true)}
          />
        )}

        {/* Sign-in nudge (guests) */}
        {hydrated && !isAuth && (
          <div className="rounded-3xl bg-white shadow-soft p-5 space-y-3">
            <p className="text-sm text-gray-600">{t('auth.signInToContinue')}</p>
            <InlineOtpLogin />
          </div>
        )}

        {/* PLANS */}
        <section id="plans" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <h2 className="text-base font-bold text-gray-900">{t('subscriptions.title')}</h2>
          </div>

          {outOfCoverage && (
            <div className="rounded-3xl bg-white shadow-soft p-5 space-y-2 border border-amber-200">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-amber-600" />
                <p className="font-bold text-amber-900">{t('subscriptions.outsideCoverageTitle')}</p>
              </div>
              <p className="text-sm text-amber-800 leading-snug">
                {eligibility?.message ?? t('subscriptions.outsideCoverageBody')}
              </p>
              {eligibility?.distanceKm != null && eligibility.maxDeliveryKm != null && (
                <p className="text-xs text-amber-700 font-mono">
                  {eligibility.distanceKm.toFixed(1)} km / {eligibility.maxDeliveryKm} km max
                </p>
              )}
            </div>
          )}

          {needsLocation && (
            <div className="rounded-3xl bg-white shadow-soft p-5 space-y-2 border border-brand-100">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-500" />
                <p className="font-bold text-gray-900">{t('subscriptions.needLocationTitle')}</p>
              </div>
              <p className="text-sm text-gray-600 leading-snug">{t('subscriptions.needLocationBody')}</p>
            </div>
          )}

          {isLoading || !plans ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-3xl" />
              ))}
            </div>
          ) : outOfCoverage || needsLocation ? null : sorted.length === 0 ? (
            <p className="rounded-3xl bg-white shadow-soft p-5 text-sm text-gray-500 text-center">
              {t('subscriptions.noPlans')}
            </p>
          ) : (
            <div className="space-y-3">
              {sorted.map((plan, i) => {
                const isRecommended = plan.id === recommendedId && sorted.length > 1;
                const isCurrent = mySub?.plan?.id === plan.id && mySub.status === 'ACTIVE';
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <PlanCard
                      plan={plan}
                      isRecommended={isRecommended}
                      isCurrent={Boolean(isCurrent)}
                      onSubscribe={() => openSubscribe(plan)}
                      t={t}
                      locale={locale}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* BENEFITS */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-brand-500" />
            <h2 className="text-base font-bold text-gray-900">{t('subscriptions.benefitsTitle')}</h2>
          </div>
          <div className="rounded-3xl bg-white shadow-soft divide-y divide-gray-100">
            {[
              { icon: Truck,        text: t('subscriptions.benefitFreeDelivery') },
              { icon: Sparkles,     text: t('subscriptions.benefitPriority') },
              { icon: BadgePercent, text: t('subscriptions.benefitOffers') },
              { icon: Check,        text: t('subscriptions.benefitCancel') },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
                  <Icon className="h-4 w-4 text-brand-600" />
                </span>
                <p className="text-sm font-medium text-gray-800">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SAVINGS COMPARISON */}
        {recommendedId && (() => {
          const rec = sorted.find((p) => p.id === recommendedId);
          if (!rec) return null;
          // Static reference: assume non-member pays 10 SAR / delivery (matches our default seed).
          const nonMember = 10;
          const memberPerDelivery =
            rec.benefitType === 'FREE_DELIVERY' ? 0
            : rec.benefitType === 'CAPPED_DELIVERY' ? Math.min(nonMember, Number(rec.cappedFee ?? nonMember))
            : Math.max(0, nonMember - Number(rec.discountValue ?? 0));
          const monthlyNon = nonMember * 12;
          const monthlyMember = memberPerDelivery * 12 + Number(rec.price);
          return (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-500" />
                <h2 className="text-base font-bold text-gray-900">{t('subscriptions.savingsTitle')}</h2>
              </div>
              <div className="rounded-3xl bg-white shadow-soft overflow-hidden">
                <div className="grid grid-cols-3 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-100">
                  <div className="px-4 py-2.5"></div>
                  <div className="px-4 py-2.5 text-center">{t('subscriptions.savingsNonMember')}</div>
                  <div className="px-4 py-2.5 text-center text-brand-700">{t('subscriptions.savingsMember')}</div>
                </div>
                <div className="grid grid-cols-3 text-sm border-b border-gray-50">
                  <div className="px-4 py-3 text-gray-600">{t('subscriptions.savingsRow1')}</div>
                  <div className="px-4 py-3 text-center font-semibold text-gray-700">{formatPrice(nonMember)}</div>
                  <div className="px-4 py-3 text-center font-bold text-brand-600">{formatPrice(memberPerDelivery)}</div>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <div className="px-4 py-3 text-gray-600">{t('subscriptions.savingsRow2')}</div>
                  <div className="px-4 py-3 text-center font-semibold text-gray-700 line-through">{formatPrice(monthlyNon)}</div>
                  <div className="px-4 py-3 text-center font-bold text-brand-600">{formatPrice(monthlyMember)}</div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* FAQ accordion */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-gray-900">{t('subscriptions.faqTitle')}</h2>
          <div className="rounded-3xl bg-white shadow-soft divide-y divide-gray-100 overflow-hidden">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-900">{item.q}</span>
                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-400"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Sticky bottom CTA — only when not already subscribed */}
      <AnimatePresence>
        {!hasActiveOrPending && sorted.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-sticky px-4 pb-4 pt-3 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent pointer-events-none"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={goToPlans}
              className="pointer-events-auto flex w-full items-center justify-between rounded-3xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3.5 text-white shadow-pop hover:from-brand-600 hover:to-brand-700 transition-colors"
            >
              <span className="inline-flex items-center gap-2 font-bold">
                <Crown className="h-4 w-4" /> {t('subscriptions.subscribeNow')}
              </span>
              <span className="text-xs opacity-90">{t('common.viewAll')}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscribe — payment method bottom sheet */}
      <BottomSheet
        open={Boolean(pickerPlan)}
        onClose={() => setPickerPlan(null)}
        title={pickerPlan ? pickLocalized(pickerPlan, locale) : ''}
      >
        {pickerPlan && (
          <div className="px-5 pb-5 pt-2 space-y-4">
            <div className="rounded-3xl bg-brand-50 px-4 py-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-brand-700">{formatPrice(pickerPlan.price)}</span>
              <span className="text-xs text-brand-700/80">{t('subscriptions.perDays', { days: pickerPlan.durationDays })}</span>
            </div>
            <p className="text-sm text-gray-600">{benefitLine(pickerPlan, t)}</p>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('subscriptions.pickPayment')}
              </p>
              {(['CASH_ON_DELIVERY', 'BANK_TRANSFER'] as Pay[]).map((m) => {
                const isSel = payMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                      isSel ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300'
                    )}
                  >
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-2xl shrink-0',
                      isSel ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
                    )}>
                      {m === 'CASH_ON_DELIVERY' ? <Wallet className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 text-start">
                      <p className="text-sm font-semibold text-gray-900">
                        {m === 'CASH_ON_DELIVERY' ? t('checkout.cashOnDelivery') : t('checkout.bankTransfer')}
                      </p>
                      {m === 'BANK_TRANSFER' && (
                        <p className="text-[11px] text-gray-500">{t('checkout.bankTransferHint')}</p>
                      )}
                    </div>
                    {isSel && <Check className="h-4 w-4 text-brand-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <Button className="w-full" size="lg" loading={submitting} onClick={confirmSubscribe}>
              {t('subscriptions.subscribeNow')} · {formatPrice(pickerPlan.price)}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* Cancel current subscription bottom sheet */}
      <BottomSheet
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={t('subscriptions.cancelCurrent')}
      >
        <div className="px-5 pb-5 pt-2 space-y-4">
          <p className="text-sm text-gray-600">{t('subscriptions.cancelConfirm')}</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={cancelling} onClick={() => setShowCancel(false)}>
              {t('common.back')}
            </Button>
            <Button variant="danger" className="flex-1" loading={cancelling} onClick={cancelSubscription}>
              <X className="h-4 w-4" /> {t('common.confirm')}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ─── plan card ─── */
function PlanCard({
  plan, isRecommended, isCurrent, onSubscribe, t, locale,
}: {
  plan: SubscriptionPlan;
  isRecommended: boolean;
  isCurrent: boolean;
  onSubscribe: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: 'ar' | 'en';
}) {
  const name = pickLocalized(plan, locale);
  return (
    <div
      className={cn(
        'relative rounded-3xl bg-white shadow-soft p-5 transition-shadow',
        isRecommended && 'ring-2 ring-brand-500/40 shadow-card',
      )}
    >
      {isRecommended && (
        <span className="absolute -top-2 end-4 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-soft">
          <Crown className="h-3 w-3" /> {t('subscriptions.recommended')}
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('subscriptions.perDays', { days: plan.durationDays })}</p>
        </div>
        <div className="text-end">
          <p className="text-2xl font-black text-brand-600 leading-none">{formatPrice(plan.price)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2.5">
        <Truck className="h-4 w-4 text-brand-600 shrink-0" />
        <p className="text-xs font-semibold text-brand-800">{benefitLine(plan, t)}</p>
      </div>

      {plan.maxFreeDeliveries != null && (
        <p className="mt-2 text-[11px] text-gray-500">
          {plan.maxFreeDeliveries} max deliveries
        </p>
      )}

      <Button
        className={cn('mt-4 w-full', isRecommended ? '' : '')}
        variant={isRecommended ? 'primary' : 'secondary'}
        onClick={onSubscribe}
        disabled={isCurrent}
      >
        {isCurrent ? t('subscriptions.current') : t('subscriptions.subscribe')}
      </Button>
    </div>
  );
}

/* ─── active subscription block ─── */
function ActiveSubscriptionCard({
  sub, t, locale, onCancel,
}: {
  sub: CustomerSubscription;
  t: ReturnType<typeof useTranslations>;
  locale: 'ar' | 'en';
  onCancel: () => void;
}) {
  const planName = pickLocalized(sub.plan, locale);
  const expiry = new Date(sub.expiryDate);
  const expiryStr = expiry.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  if (sub.status === 'PENDING_PAYMENT') {
    return (
      <div className="rounded-3xl bg-white shadow-card p-5 border-2 border-amber-200">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Clock className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">{t('subscriptions.pendingTitle')}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t('subscriptions.pendingBody')}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">{planName}</p>
      </div>
    );
  }

  if (sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
    return (
      <div className="rounded-3xl bg-white shadow-card p-5 border-2 border-gray-200">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">{t('subscriptions.expiredTitle')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('subscriptions.expiredBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-card bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5">
      <div className="absolute -end-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
            <Crown className="h-3 w-3" /> {t('common.active')}
          </span>
        </div>
        <div>
          <p className="text-xl font-black leading-tight">{planName}</p>
          <p className="text-xs text-white/85 mt-1">{t('subscriptions.expiresOn', { date: expiryStr })}</p>
          {typeof sub.deliveriesUsed === 'number' && (
            <p className="text-xs text-white/85 mt-0.5">{t('subscriptions.deliveriesUsed', { used: sub.deliveriesUsed })}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 text-xs font-semibold"
        >
          <X className="h-3.5 w-3.5" /> {t('subscriptions.cancelCurrent')}
        </button>
      </div>
    </div>
  );
}
