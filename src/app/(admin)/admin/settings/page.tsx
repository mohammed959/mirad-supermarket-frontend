'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { MapPin, ArrowRight, LayoutGrid, Phone } from 'lucide-react';
import api from '@/lib/api';
import { HomeSettings, ContactSettings } from '@/types';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

// Mirrors the backend clamp in settings.service.ts.
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;

/**
 * Admin settings. Delivery pricing lives in `/admin/branch-coverage`
 * (pointer card below). This page owns storefront presentation settings —
 * currently the homepage "All Products" item count.
 */
export default function AdminSettingsPage() {
  const t = useTranslations();

  const { data: home, mutate } = useSWR<HomeSettings>('/settings/home', fetcher);
  const { data: contact, mutate: mutateContact } = useSWR<ContactSettings>('/contact-us', fetcher);

  const [allProductsLimit, setAllProductsLimit] = useState('20');
  const [saving, setSaving] = useState(false);

  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    if (home?.allProductsLimit != null) setAllProductsLimit(String(home.allProductsLimit));
  }, [home]);

  useEffect(() => {
    if (contact) {
      setContactPhone(contact.phone ?? '');
      setContactWhatsapp(contact.whatsapp ?? '');
    }
  }, [contact]);

  const saveHome = async () => {
    const value = parseInt(allProductsLimit, 10);
    if (!Number.isFinite(value) || value < LIMIT_MIN || value > LIMIT_MAX) {
      toast.error(t('admin.allProductsLimitRange', { min: LIMIT_MIN, max: LIMIT_MAX }));
      return;
    }
    setSaving(true);
    try {
      await api.put('/settings/home', { allProductsLimit: value });
      await mutate();
      toast.success(t('common.saveChanges'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    setSavingContact(true);
    try {
      await api.put('/contact-us', {
        phone: contactPhone.trim() || null,
        whatsapp: contactWhatsapp.trim() || null,
      });
      await mutateContact();
      toast.success(t('common.saveChanges'));
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('admin.settings')}</h1>

      {/* Homepage presentation */}
      <div className="rounded-2xl bg-white border border-gray-100 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <LayoutGrid className="h-5 w-5 text-brand-500" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-gray-900">{t('admin.homepageProducts')}</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('admin.allProductsLimitHint')}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="allProductsLimit" className="block text-sm font-medium text-gray-700">
            {t('admin.allProductsLimit')}
          </label>
          <input
            id="allProductsLimit"
            type="number"
            min={LIMIT_MIN}
            max={LIMIT_MAX}
            value={allProductsLimit}
            onChange={(e) => setAllProductsLimit(e.target.value)}
            className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <button
          onClick={saveHome}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
        >
          {saving ? t('common.loading') : t('common.saveChanges')}
        </button>
      </div>

      {/* Contact information */}
      <div className="rounded-2xl bg-white border border-gray-100 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <Phone className="h-5 w-5 text-brand-500" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-gray-900">{t('admin.contactInfo')}</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('admin.contactInfoHint')}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">
            {t('admin.contactPhone')}
          </label>
          <input
            id="contactPhone"
            type="tel"
            maxLength={32}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+966500000000"
            className="w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactWhatsapp" className="block text-sm font-medium text-gray-700">
            {t('admin.contactWhatsapp')}
          </label>
          <input
            id="contactWhatsapp"
            type="tel"
            maxLength={32}
            value={contactWhatsapp}
            onChange={(e) => setContactWhatsapp(e.target.value)}
            placeholder="+966500000000"
            className="w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <button
          onClick={saveContact}
          disabled={savingContact}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
        >
          {savingContact ? t('common.loading') : t('common.saveChanges')}
        </button>
      </div>

      {/* Delivery pointer card (delivery config lives in Branch & Coverage) */}
      <div className="rounded-2xl bg-white border border-gray-100 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <MapPin className="h-5 w-5 text-brand-500" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-gray-900">Delivery, free-delivery threshold, and minimum order</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              All delivery fee configuration — distance rules, the free delivery threshold, and the
              minimum order amount — is now managed in <strong>Branch &amp; Coverage</strong>. This page
              no longer applies delivery settings.
            </p>
          </div>
        </div>

        <Link
          href="/admin/branch-coverage"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          Go to Branch &amp; Coverage
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
