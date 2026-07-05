'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations, useLocale } from 'next-intl';
import {
  MapPin, Save, Plus, Trash2, AlertTriangle, ShieldCheck,
  ChevronDown, ChevronUp, Percent, Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import { LocationPickerMap } from '@/components/maps/LocationPickerMap';
import { PolygonDrawerMap } from '@/components/maps/PolygonDrawerMap';
import { LatLng, NamedArea } from '@/lib/geo';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

interface BranchData {
  configured: boolean;
  branch: {
    id: string;
    name: string;
    nameAr: string;
    address: string;
    latitude: number;
    longitude: number;
    phone: string | null;
    deliveryAreas: NamedArea[] | null;
    excludedPolygons: LatLng[][] | null;
  } | null;
}

interface DeliverySettings {
  id: string;
  deliveryEnabled: boolean;
  distanceRulesEnabled: boolean;
  maxDeliveryKm: number | string | null;
  baseFee: number | string;
  feePerKm: number | string;
  minimumFee: number | string;
  maximumFee: number | string;
  roadDistanceMultiplier?: number | string | null;
  freeDeliveryEnabled?: boolean | null;
  freeDeliveryThreshold?: number | string | null;
}

interface MinimumOrderSettings {
  id?: string;
  enabled: boolean;
  minimumAmount: number | string;
}

interface DistanceRuleRow {
  minKm: string;
  maxKm: string;
  fee: string;
  outOfService: boolean;
  discountPercent: string;
  discountStartDate: string;
  discountEndDate: string;
  basketThreshold: string;
  feeAboveThreshold: string;
  expanded: boolean;
}

interface DistanceRuleApi {
  id: string;
  minKm: number | string;
  maxKm: number | string | null;
  fee: number | string;
  outOfService: boolean;
  discountPercent: number | string | null;
  discountStartDate: string | null;
  discountEndDate: string | null;
  basketThreshold: number | string | null;
  feeAboveThreshold: number | string | null;
}

const emptyRule: DistanceRuleRow = {
  minKm: '',
  maxKm: '',
  fee: '',
  outOfService: false,
  discountPercent: '',
  discountStartDate: '',
  discountEndDate: '',
  basketThreshold: '',
  feeAboveThreshold: '',
  expanded: false,
};

// YYYY-MM-DD slice from an ISO date string for the <input type="date"> values.
const ymd = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export default function BranchCoveragePage() {
  const t = useTranslations();
  const locale = useLocale();
  const mapLang: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en';

  const { data: branchData, mutate: mutateBranch, isLoading: loadingBranch } = useSWR<BranchData>('/delivery/branch', fetcher);
  const { data: settings,    mutate: mutateSettings, isLoading: loadingSettings } = useSWR<DeliverySettings | null>('/delivery/settings', fetcher);
  const { data: minOrder,    mutate: mutateMinOrder, isLoading: loadingMinOrder } = useSWR<MinimumOrderSettings | null>('/delivery/minimum-order', fetcher);
  const { data: rulesApi,    mutate: mutateRules,    isLoading: loadingRules }   = useSWR<DistanceRuleApi[]>('/delivery/distance-rules', fetcher);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  // Polygon-based coverage: one named area per supported city. Replaces the
  // former single delivery polygon and the radius/maxDeliveryKm model.
  const [areas, setAreas] = useState<NamedArea[]>([]);
  const [excludedPolygons, setExcludedPolygons] = useState<LatLng[][]>([]);
  const [savingBranch, setSavingBranch] = useState(false);

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [distanceRulesEnabled, setDistanceRulesEnabled] = useState(false);
  const [roadMultiplier, setRoadMultiplier] = useState('1.00');
  // Phase 4: free-delivery threshold and minimum-order amount are now
  // configured here too, not in /admin/settings.
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState(false);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('');
  const [minOrderEnabled, setMinOrderEnabled] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [rules, setRules] = useState<DistanceRuleRow[]>([emptyRule]);
  const [savingRules, setSavingRules] = useState(false);

  // Sync data → local form state when SWR resolves.
  useEffect(() => {
    if (!branchData?.branch) return;
    setName(branchData.branch.name);
    setNameAr(branchData.branch.nameAr);
    setAddress(branchData.branch.address);
    setPhone(branchData.branch.phone ?? '');
    setPin({ lat: branchData.branch.latitude, lng: branchData.branch.longitude });
    setAreas(branchData.branch.deliveryAreas ?? []);
    setExcludedPolygons(branchData.branch.excludedPolygons ?? []);
  }, [branchData]);

  useEffect(() => {
    if (!settings) return;
    setDeliveryEnabled(Boolean(settings.deliveryEnabled));
    setDistanceRulesEnabled(Boolean(settings.distanceRulesEnabled));
    setRoadMultiplier(
      settings.roadDistanceMultiplier != null
        ? String(settings.roadDistanceMultiplier)
        : '1.00',
    );
    setFreeDeliveryEnabled(Boolean(settings.freeDeliveryEnabled));
    setFreeDeliveryThreshold(
      settings.freeDeliveryThreshold != null ? String(settings.freeDeliveryThreshold) : '',
    );
  }, [settings]);

  useEffect(() => {
    if (!minOrder) return;
    setMinOrderEnabled(Boolean(minOrder.enabled));
    setMinOrderAmount(minOrder.minimumAmount != null ? String(minOrder.minimumAmount) : '');
  }, [minOrder]);

  useEffect(() => {
    if (!rulesApi) return;
    setRules(
      rulesApi.length === 0
        ? [emptyRule]
        : rulesApi.map((r) => ({
            minKm: String(r.minKm ?? ''),
            maxKm: r.maxKm == null ? '' : String(r.maxKm),
            fee: String(r.fee ?? '0'),
            outOfService: Boolean(r.outOfService),
            discountPercent: r.discountPercent == null ? '' : String(r.discountPercent),
            discountStartDate: ymd(r.discountStartDate),
            discountEndDate: ymd(r.discountEndDate),
            basketThreshold: r.basketThreshold == null ? '' : String(r.basketThreshold),
            feeAboveThreshold: r.feeAboveThreshold == null ? '' : String(r.feeAboveThreshold),
            expanded:
              r.discountPercent != null ||
              r.basketThreshold != null ||
              r.feeAboveThreshold != null,
          })),
    );
  }, [rulesApi]);

  const handlePinChange = useCallback((loc: { lat: number; lng: number; address?: string }) => {
    setPin({ lat: loc.lat, lng: loc.lng });
    if (loc.address && !address) setAddress(loc.address);
  }, [address]);

  const saveBranch = async () => {
    if (!pin) return toast.error(t('checkout.dropPinFirst'));
    if (!name.trim() || !nameAr.trim() || !address.trim()) {
      return toast.error(t('validation.required'));
    }
    // Every drawn area must be named (backend rejects unnamed areas).
    const validAreas = areas.filter((a) => a.polygon.length >= 3);
    if (validAreas.some((a) => !a.name.trim() && !a.nameAr.trim())) {
      return toast.error(t('admin.areaNeedsName'));
    }
    setSavingBranch(true);
    try {
      await api.put('/delivery/branch', {
        name: name.trim(),
        nameAr: nameAr.trim(),
        address: address.trim(),
        latitude: pin.lat,
        longitude: pin.lng,
        phone: phone.trim() || null,
        // Empty array clears coverage. Excluded rings are only meaningful when
        // at least one service area exists.
        deliveryAreas: validAreas.length
          ? validAreas.map((a) => ({
              name: a.name.trim(),
              nameAr: a.nameAr.trim(),
              polygon: a.polygon,
            }))
          : null,
        excludedPolygons: validAreas.length ? excludedPolygons : [],
      });
      await mutateBranch();
      toast.success(t('admin.saveBranch'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save branch');
    } finally {
      setSavingBranch(false);
    }
  };

  const saveSettings = async () => {
    const numericMultiplier = roadMultiplier.trim() === '' ? 1 : Number(roadMultiplier);
    if (!Number.isFinite(numericMultiplier) || numericMultiplier < 0.5 || numericMultiplier > 3) {
      return toast.error('Road distance multiplier must be between 0.5 and 3.0.');
    }

    // Free-delivery threshold: amount required when enabled.
    let freeThresholdValue: number | null = null;
    if (freeDeliveryEnabled) {
      const v = Number(freeDeliveryThreshold);
      if (!Number.isFinite(v) || v < 0) {
        return toast.error('Free delivery threshold must be 0 or greater.');
      }
      freeThresholdValue = v;
    }

    // Minimum order: amount required when enabled.
    let minOrderValue = 0;
    if (minOrderEnabled) {
      const v = Number(minOrderAmount);
      if (!Number.isFinite(v) || v <= 0) {
        return toast.error('Minimum order amount must be greater than 0.');
      }
      minOrderValue = v;
    }

    setSavingSettings(true);
    try {
      // Phase 4: the single source of truth is /admin/branch-coverage,
      // so this handler now writes both the delivery-pricing settings
      // (free threshold + coverage) and the minimum-order singleton in
      // parallel. Phase 2's Zod whitelist strips any legacy fee fields
      // we still need to round-trip, so we only send what the calc reads.
      await Promise.all([
        api.put('/delivery/settings', {
          deliveryEnabled,
          distanceRulesEnabled,
          roadDistanceMultiplier: Math.round(numericMultiplier * 100) / 100,
          freeDeliveryEnabled,
          freeDeliveryThreshold: freeThresholdValue,
        }),
        api.put('/delivery/minimum-order', {
          enabled: minOrderEnabled,
          minimumAmount: minOrderValue,
        }),
      ]);
      await Promise.all([mutateSettings(), mutateMinOrder()]);
      toast.success('Coverage settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  // Client-side overlap check, mirrors the backend rule so admins see the
  // problem as they type — backend re-validates on save anyway.
  const overlapError = useMemo(() => validateRules(rules), [rules]);

  const saveRules = async () => {
    if (overlapError) return toast.error(overlapError);
    const payload = rules
      .filter((r) => r.minKm !== '' || r.maxKm !== '' || r.fee !== '' || r.outOfService)
      .map((r) => {
        const hasThreshold = r.basketThreshold !== '' || r.feeAboveThreshold !== '';
        return {
          minKm: Number(r.minKm),
          maxKm: r.maxKm === '' ? null : Number(r.maxKm),
          fee: r.outOfService ? 0 : Number(r.fee || 0),
          outOfService: r.outOfService,
          discountPercent: r.discountPercent === '' ? null : Number(r.discountPercent),
          discountStartDate: r.discountStartDate === '' ? null : r.discountStartDate,
          discountEndDate: r.discountEndDate === '' ? null : r.discountEndDate,
          basketThreshold: hasThreshold && r.basketThreshold !== '' ? Number(r.basketThreshold) : null,
          feeAboveThreshold: hasThreshold && r.feeAboveThreshold !== '' ? Number(r.feeAboveThreshold) : null,
        };
      });
    setSavingRules(true);
    try {
      await api.put('/delivery/distance-rules', { rules: payload });
      await mutateRules();
      toast.success(t('admin.saveRules'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save rules');
    } finally {
      setSavingRules(false);
    }
  };

  if (loadingBranch || loadingSettings || loadingMinOrder || loadingRules) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.branchLocation')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set the branch coordinates and distance-based delivery coverage. Customers can't shop until the branch is configured.
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
            branchData?.configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {branchData?.configured ? 'Active' : 'Setup needed'}
        </span>
      </header>

      {!branchData?.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('admin.branchNotConfiguredTitle')}</p>
            <p className="text-xs text-amber-800 mt-0.5 leading-snug">{t('admin.branchNotConfiguredBody')}</p>
          </div>
        </div>
      )}

      {/* Branch location */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-brand-500" />
          <h2 className="font-semibold text-gray-900">{t('admin.branchSettings')}</h2>
        </div>

        <LocationPickerMap
          lat={pin?.lat ?? null}
          lng={pin?.lng ?? null}
          onChange={handlePinChange}
          language={mapLang}
          height={320}
        />
        {pin && (
          <p className="text-[11px] text-gray-500 font-mono">
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Branch name (EN)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Branch name (AR)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <Input label={t('checkout.addressDetails')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />

        {/* ─── Delivery service area (polygon) ──────────────────────── */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="font-semibold text-gray-900">{t('admin.deliveryArea')}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('admin.deliveryAreaHint')}</p>
          <PolygonDrawerMap
            storeLat={pin?.lat ?? null}
            storeLng={pin?.lng ?? null}
            areas={areas}
            excludedPolygons={excludedPolygons}
            onChange={({ areas: nextAreas, excluded }) => {
              setAreas(nextAreas);
              setExcludedPolygons(excluded);
            }}
            onError={(msg) => toast.error(msg)}
            language={mapLang}
            height={420}
          />
          {areas.length === 0 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('admin.noDeliveryAreaWarning')}
            </p>
          )}
        </div>

        <Button loading={savingBranch} onClick={saveBranch}>
          <Save className="h-4 w-4" /> {t('admin.saveBranch')}
        </Button>
      </section>

      {/* Coverage settings */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">{t('admin.deliveryCoverage')}</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={deliveryEnabled}
            onChange={(e) => setDeliveryEnabled(e.target.checked)}
            className="accent-brand-500 h-4 w-4"
          />
          <span className="text-sm font-medium text-gray-700">{t('admin.deliveryEnabled')}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={distanceRulesEnabled}
            onChange={(e) => setDistanceRulesEnabled(e.target.checked)}
            className="accent-brand-500 h-4 w-4"
          />
          <span className="text-sm font-medium text-gray-700">{t('admin.useDistanceRules')}</span>
        </label>

        <div className="space-y-1.5">
          <Input
            label="Road distance multiplier"
            type="number"
            inputMode="decimal"
            min="0.5"
            max="3"
            step="0.05"
            value={roadMultiplier}
            onChange={(e) => setRoadMultiplier(e.target.value)}
            placeholder="1.00"
          />
          <p className="text-xs text-gray-500 leading-relaxed">
            The system uses straight-line distance (haversine) between the branch and the customer.
            Real driving distance is usually longer. Use this multiplier to calibrate it:
            <strong> 1.00</strong> = use straight-line as-is, <strong> 1.30–1.45</strong> is typical for dense urban
            areas, <strong> 1.50</strong> or higher for suburbs with limited road connectivity. Allowed range:
            0.50 – 3.00.
          </p>
        </div>

        {/* ─── Free delivery threshold ───────────────────────────────── */}
        <div className="space-y-2 border-t pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={freeDeliveryEnabled}
              onChange={(e) => setFreeDeliveryEnabled(e.target.checked)}
              className="accent-brand-500 h-4 w-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Enable free delivery threshold
            </span>
          </label>
          {freeDeliveryEnabled && (
            <Input
              label="Threshold amount (SAR)"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={freeDeliveryThreshold}
              onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
              placeholder="e.g. 100"
            />
          )}
          <p className="text-xs text-gray-500 leading-relaxed">
            When the customer's cart subtotal is at or above this amount, delivery becomes free for
            non-subscribed customers. Subscribed customers still follow their plan&apos;s delivery logic.
          </p>
        </div>

        {/* ─── Minimum order amount ─────────────────────────────────── */}
        <div className="space-y-2 border-t pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={minOrderEnabled}
              onChange={(e) => setMinOrderEnabled(e.target.checked)}
              className="accent-brand-500 h-4 w-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Enforce minimum order amount
            </span>
          </label>
          {minOrderEnabled && (
            <Input
              label="Minimum amount (SAR)"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="e.g. 30"
            />
          )}
          <p className="text-xs text-gray-500 leading-relaxed">
            Carts below this amount cannot proceed to checkout or place an order. Applies to every
            customer, including subscribed customers.
          </p>
        </div>

        <Button variant="secondary" loading={savingSettings} onClick={saveSettings}>
          <Save className="h-4 w-4" /> Save coverage settings
        </Button>
      </section>

      {/* Distance rules */}
      {distanceRulesEnabled && (
        <section className="rounded-2xl bg-white border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Distance-based fees</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRules((r) => [...r, emptyRule])}
            >
              <Plus className="h-3.5 w-3.5" /> {t('admin.addRange')}
            </Button>
          </div>

          {overlapError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{overlapError}</p>
            </div>
          )}

          <div className="space-y-3">
            {rules.map((row, idx) => {
              const hasDiscount = row.discountPercent !== '';
              const hasThreshold = row.basketThreshold !== '' || row.feeAboveThreshold !== '';
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-100 bg-white p-3 space-y-3"
                >
                  {/* Primary row */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('admin.rangeFrom')}
                      </label>
                      <input
                        type="number"
                        value={row.minKm}
                        onChange={(e) => updateRule(setRules, idx, { minKm: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('admin.rangeTo')}
                      </label>
                      <input
                        type="number"
                        value={row.maxKm}
                        onChange={(e) => updateRule(setRules, idx, { maxKm: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        placeholder="∞"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('admin.feeSar')}
                      </label>
                      <input
                        type="number"
                        value={row.fee}
                        disabled={row.outOfService}
                        onChange={(e) => updateRule(setRules, idx, { fee: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-600 pb-1.5">
                        <input
                          type="checkbox"
                          checked={row.outOfService}
                          onChange={(e) => updateRule(setRules, idx, { outOfService: e.target.checked })}
                          className="accent-brand-500 h-4 w-4"
                        />
                        {t('admin.outOfService')}
                      </label>
                    </div>
                    <div className="col-span-1 text-end pb-1">
                      <button
                        onClick={() => setRules((r) => r.filter((_, i) => i !== idx))}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Advanced toggle */}
                  {!row.outOfService && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateRule(setRules, idx, { expanded: !row.expanded })}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                      >
                        {row.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {t('admin.advancedRule')}
                        {(hasDiscount || hasThreshold) && !row.expanded && (
                          <span className="ms-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                            {[hasDiscount && t('admin.discount'), hasThreshold && t('admin.basketThreshold')]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </button>

                      {row.expanded && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                          {/* Discount */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                              <Percent className="h-3 w-3" />
                              {t('admin.discountOptional')}
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] text-gray-500">{t('admin.discountPercent')}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={row.discountPercent}
                                  onChange={(e) => updateRule(setRules, idx, { discountPercent: e.target.value })}
                                  placeholder="e.g. 25"
                                  className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-500">{t('admin.discountStart')}</label>
                                  <input
                                    type="date"
                                    value={row.discountStartDate}
                                    onChange={(e) => updateRule(setRules, idx, { discountStartDate: e.target.value })}
                                    className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500">{t('admin.discountEnd')}</label>
                                  <input
                                    type="date"
                                    value={row.discountEndDate}
                                    onChange={(e) => updateRule(setRules, idx, { discountEndDate: e.target.value })}
                                    className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Basket threshold override */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                              <Wallet className="h-3 w-3" />
                              {t('admin.basketOverrideOptional')}
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] text-gray-500">{t('admin.basketThreshold')}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.basketThreshold}
                                  onChange={(e) => updateRule(setRules, idx, { basketThreshold: e.target.value })}
                                  placeholder="e.g. 200"
                                  className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500">{t('admin.feeAboveThreshold')}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.feeAboveThreshold}
                                  onChange={(e) => updateRule(setRules, idx, { feeAboveThreshold: e.target.value })}
                                  placeholder="e.g. 0"
                                  className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                />
                              </div>
                              <p className="text-[10px] text-gray-500 leading-snug">
                                {t('admin.basketOverrideHint')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-500">
            Tip: leave the final <code className="font-mono">To</code> cell empty to make it open-ended (e.g. "more than 20 km").
          </p>

          <Button loading={savingRules} disabled={Boolean(overlapError)} onClick={saveRules}>
            <Save className="h-4 w-4" /> {t('admin.saveRules')}
          </Button>
        </section>
      )}
    </div>
  );
}

function updateRule(
  setRules: React.Dispatch<React.SetStateAction<DistanceRuleRow[]>>,
  idx: number,
  patch: Partial<DistanceRuleRow>,
) {
  setRules((rules) => rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
}

function validateRules(rules: DistanceRuleRow[]): string | null {
  const cleaned = rules
    .map((r, i) => ({ i, ...r }))
    .filter((r) => r.minKm !== '' || r.maxKm !== '' || r.fee !== '' || r.outOfService);
  if (cleaned.length === 0) return null;
  for (const r of cleaned) {
    const min = Number(r.minKm);
    if (!Number.isFinite(min) || min < 0) return `Row ${r.i + 1}: from-km must be ≥ 0.`;
    if (r.maxKm !== '') {
      const max = Number(r.maxKm);
      if (!Number.isFinite(max) || max <= min) return `Row ${r.i + 1}: to-km must be greater than from-km.`;
    }
    if (!r.outOfService) {
      const fee = Number(r.fee || 0);
      if (!Number.isFinite(fee) || fee < 0) return `Row ${r.i + 1}: fee must be ≥ 0.`;
    }
  }
  const sorted = [...cleaned].sort((a, b) => Number(a.minKm) - Number(b.minKm));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const prevMax = prev.maxKm === '' ? Infinity : Number(prev.maxKm);
    if (Number(sorted[i].minKm) < prevMax) {
      return `Ranges overlap: ${prev.minKm}–${prev.maxKm || '∞'} km overlaps ${sorted[i].minKm}–${sorted[i].maxKm || '∞'} km.`;
    }
  }
  // Open-ended is only allowed on the last entry by sortedness.
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].maxKm === '') return `Only the last range can be open-ended (no to-km value).`;
  }
  return null;
}
