'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import toast from 'react-hot-toast';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, MapPin, Check, Plus, Trash2, Pencil, Star, X } from 'lucide-react';
import api from '@/lib/api';
import { CustomerAddress } from '@/types';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocationStore } from '@/stores/locationStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineOtpLogin } from '@/components/customer/InlineOtpLogin';
import { LocationPickerMap } from '@/components/maps/LocationPickerMap';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

type FormMode = { kind: 'new' } | { kind: 'edit'; address: CustomerAddress } | null;

export default function LocationPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const mapLang: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en';
  const { mutate } = useSWRConfig();
  const isAuth = useCustomerAuthStore((s) => s.isAuthenticated);
  const setLocation = useLocationStore((s) => s.setLocation);
  const currentAddressId = useLocationStore((s) => s.addressId);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { data, isLoading } = useSWR<CustomerAddress[]>(
    isAuth ? '/addresses' : null,
    fetcher,
  );

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [label, setLabelV] = useState('Home');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Reset form fields whenever the mode changes — new flow starts blank, edit
  // flow prefills from the address we're editing.
  useEffect(() => {
    if (formMode == null) return;
    if (formMode.kind === 'new') {
      setLabelV('Home');
      setAddressLine('');
      setCity('');
      setDeliveryNotes('');
      setPin(null);
    } else {
      const addr = formMode.address;
      setLabelV(addr.label || 'Home');
      setAddressLine(addr.addressLine ?? '');
      setCity(addr.city ?? '');
      setDeliveryNotes(addr.deliveryNotes ?? '');
      setPin({ lat: Number(addr.latitude), lng: Number(addr.longitude) });
    }
  }, [formMode]);

  const handlePinChange = useCallback(
    (loc: { lat: number; lng: number; address?: string; city?: string | null }) => {
      setPin({ lat: loc.lat, lng: loc.lng });
      // Auto-fill the fields below the map on every pin move (reverse-geocode).
      // We overwrite so the details always reflect the current pin — the
      // customer can still edit afterwards; the next pin move refreshes again.
      if (loc.address) setAddressLine(loc.address);
      if (loc.city) setCity(loc.city);
    },
    [],
  );

  /** Sets the in-session "active" address used for checkout. */
  const handleSelect = (addr: CustomerAddress) => {
    setLocation({
      label: addr.label,
      addressLine: addr.addressLine,
      latitude: Number(addr.latitude),
      longitude: Number(addr.longitude),
      addressId: addr.id,
    });
    toast.success(`${t('nav.deliverTo')} ${addr.label}`);
    router.back();
  };

  /** Makes the address the customer's persistent default. Separate from
   *  in-session active selection — a customer might pick a different address
   *  for one order without changing their saved default. */
  const handleSetDefault = async (addr: CustomerAddress) => {
    setSettingDefaultId(addr.id);
    try {
      await api.patch(`/addresses/${addr.id}/default`);
      await mutate('/addresses');
      toast.success(t('checkout.defaultUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to set default');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleSave = async () => {
    if (!pin) {
      toast.error(t('checkout.dropPinFirst'));
      return;
    }
    if (!label.trim()) {
      toast.error(t('validation.required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: label.trim(),
        addressLine: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || null,
        latitude: pin.lat,
        longitude: pin.lng,
      };

      const isEdit = formMode?.kind === 'edit';
      let saved: CustomerAddress;
      if (isEdit && formMode) {
        const res = await api.put<{ data: CustomerAddress }>(
          `/addresses/${formMode.address.id}`,
          payload,
        );
        saved = res.data.data;
      } else {
        const res = await api.post<{ data: CustomerAddress }>('/addresses', {
          ...payload,
          isDefault: !data || data.length === 0,
        });
        saved = res.data.data;
      }

      await mutate('/addresses');

      // Auto-select the just-saved address as the active delivery location so
      // checkout and delivery calculations use it immediately — no extra tap.
      // Applies to BOTH new and updated addresses.
      setLocation({
        label: saved.label,
        addressLine: saved.addressLine,
        latitude: Number(saved.latitude),
        longitude: Number(saved.longitude),
        addressId: saved.id,
      });
      toast.success(isEdit ? t('checkout.addressUpdated') : `${t('nav.deliverTo')} ${saved.label}`);
      router.back();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/addresses/${id}`);
      await mutate('/addresses');
      toast.success('Address removed');
      if (id === currentAddressId) useLocationStore.getState().clear();
    } catch {
      toast.error('Could not delete address');
    }
  };

  if (!hydrated) return null;

  return (
    <div className="-mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] flex-col bg-white">
      <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="font-bold text-gray-900">{t('checkout.chooseLocation')}</h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {!isAuth ? (
          <>
            <p className="text-sm text-gray-600">{t('auth.signInToContinue')}</p>
            <InlineOtpLogin />
          </>
        ) : (
          <>
            {/* Saved addresses */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {t('checkout.savedAddresses')}
                </h2>
                <button
                  onClick={() =>
                    setFormMode((m) => (m?.kind === 'new' ? null : { kind: 'new' }))
                  }
                  className="flex items-center gap-1 rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  {formMode?.kind === 'new' ? t('common.cancel') : t('checkout.addNew')}
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              ) : (data ?? []).length === 0 && formMode?.kind !== 'new' ? (
                <EmptyState
                  title={t('checkout.savedAddresses')}
                  description={t('checkout.addNew')}
                />
              ) : (
                <div className="space-y-2">
                  {data?.map((addr) => {
                    const active = addr.id === currentAddressId;
                    const isEditing = formMode?.kind === 'edit' && formMode.address.id === addr.id;
                    return (
                      <div
                        key={addr.id}
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border p-3',
                          active
                            ? 'border-brand-300 bg-brand-50'
                            : isEditing
                              ? 'border-violet-300 bg-violet-50'
                              : 'border-gray-100 bg-white',
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100">
                          <MapPin className="h-5 w-5 text-brand-600" />
                        </div>
                        <button
                          onClick={() => handleSelect(addr)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="font-semibold text-gray-900 leading-tight flex items-center gap-1.5 flex-wrap">
                            {addr.label}
                            {addr.isDefault && (
                              <span className="rounded-md bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-700 inline-flex items-center gap-0.5">
                                <Star className="h-2.5 w-2.5 fill-yellow-600 text-yellow-600" />
                                {t('checkout.defaultBadge')}
                              </span>
                            )}
                            {active && (
                              <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                                {t('checkout.activeBadge')}
                              </span>
                            )}
                          </p>
                          {addr.addressLine && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {addr.addressLine}
                            </p>
                          )}
                          {addr.deliveryNotes && (
                            <p className="text-[11px] text-gray-500 mt-0.5 italic line-clamp-2">
                              {t('checkout.deliveryNotesLabel')}: {addr.deliveryNotes}
                            </p>
                          )}
                        </button>
                        <div className="flex items-start gap-0.5">
                          {active && <Check className="h-4 w-4 text-brand-600 mt-1.5" />}
                          {!addr.isDefault && (
                            <button
                              onClick={() => handleSetDefault(addr)}
                              disabled={settingDefaultId === addr.id}
                              aria-label={t('checkout.setAsDefault')}
                              title={t('checkout.setAsDefault')}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors disabled:opacity-40"
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setFormMode({ kind: 'edit', address: addr })}
                            aria-label={t('checkout.editAddress')}
                            title={t('checkout.editAddress')}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(addr.id)}
                            aria-label={t('checkout.deleteAddress')}
                            title={t('checkout.deleteAddress')}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Add / edit form */}
            {formMode && (
              <section className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {formMode.kind === 'edit' ? t('checkout.editAddress') : t('checkout.addNew')}
                  </h3>
                  <button
                    onClick={() => setFormMode(null)}
                    aria-label={t('common.close')}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <LocationPickerMap
                  lat={pin?.lat ?? null}
                  lng={pin?.lng ?? null}
                  onChange={handlePinChange}
                  language={mapLang}
                  height={300}
                />

                {pin && (
                  <p className="text-[11px] text-gray-500 font-mono">
                    {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                  </p>
                )}

                <Input
                  label={t('checkout.addressLabel')}
                  placeholder="Home / Office"
                  value={label}
                  onChange={(e) => setLabelV(e.target.value)}
                />
                <Input
                  label={t('checkout.addressDetails')}
                  placeholder={t('checkout.addressDetailsPlaceholder')}
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
                <Input
                  label={t('checkout.city')}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    {t('checkout.deliveryNotesLabel')}
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder={t('checkout.deliveryNotesPlaceholder')}
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <Button
                  className="w-full"
                  loading={saving}
                  onClick={handleSave}
                  disabled={!pin}
                >
                  {formMode.kind === 'edit'
                    ? t('checkout.saveChanges')
                    : t('checkout.saveAddress')}
                </Button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
