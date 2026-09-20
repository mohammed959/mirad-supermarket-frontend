'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Package, Star, LogOut, ChevronRight, Heart, RotateCcw, MapPin, Settings, FileText, ShieldCheck, Phone, MessageCircle } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { BottomSheet } from '@/components/ui/BottomSheet';
import api from '@/lib/api';
import { ContactSettings } from '@/types';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function AccountPage() {
  const t = useTranslations();
  const { user, isAuthenticated, logout } = useCustomerAuthStore();
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const { data: contact } = useSWR<ContactSettings>('/contact-us', fetcher);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  if (!user) return null;

  const links = [
    { icon: Package,  label: t('orders.myOrders'),       href: '/orders' },
    { icon: Heart,    label: t('nav.favorites'),         href: '/favorites' },
    { icon: RotateCcw, label: t('nav.buyAgain'),         href: '/buy-again' },
    { icon: Star,     label: t('subscriptions.title'),   href: '/subscriptions' },
    { icon: MapPin,   label: t('checkout.savedAddresses'), href: '/checkout/location' },
    { icon: Settings, label: t('account.settings'),      href: '/account/settings' },
    { icon: Phone,    label: t('account.contactUs'),     onClick: () => setContactOpen(true) },
    { icon: FileText, label: t('account.termsAndConditions'), href: '/terms-and-conditions' },
    { icon: ShieldCheck, label: t('account.privacyPolicy'),  href: '/privacy-policy' },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Profile card */}
      <div className="rounded-2xl bg-brand-500 p-5 text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold mb-3">
          {user.name?.[0]?.toUpperCase() ?? user.mobile?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}
        </div>
        <p className="font-bold text-lg">{user.name ?? t('nav.account')}</p>
        <p className="text-brand-100 text-sm font-mono">{user.mobile ?? user.email ?? ''}</p>
        <span className="mt-2 inline-block rounded-lg bg-white/20 px-2.5 py-0.5 text-xs font-semibold capitalize">
          {user.role.replace('_', ' ').toLowerCase()}
        </span>
      </div>

      {/* Language toggle */}
      <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 px-4 py-3">
        <span className="text-sm font-medium text-gray-700">{t('common.language')}</span>
        <LanguageSwitcher />
      </div>

      {/* Nav links */}
      <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
        {links.map(({ icon: Icon, label, href, onClick }) => {
          const content = (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
                <Icon className="h-4 w-4 text-brand-500" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
              <ChevronRight className="h-4 w-4 text-gray-400 rtl:rotate-180" />
            </>
          );
          if (href) {
            return (
              <Link key={label} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                {content}
              </Link>
            );
          }
          return (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-gray-50 transition-colors"
            >
              {content}
            </button>
          );
        })}
      </div>

      {/* The account page belongs to the customer scope. Staff roles cannot
          reach this customer session anymore — staff sign in independently at
          /admin/login — so there are no role-specific portal shortcuts here. */}

      <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50" onClick={() => { logout(); router.push('/'); }}>
        <LogOut className="h-4 w-4" />
        {t('auth.signOut')}
      </Button>

      <BottomSheet open={contactOpen} onClose={() => setContactOpen(false)} title={t('account.contactUs')}>
        <div className="px-5 pb-5 pt-2 space-y-3">
          <p className="text-sm text-gray-600">{t('account.contactUsHint')}</p>

          {!contact?.phone && !contact?.whatsapp && (
            <p className="text-sm text-gray-500">{t('account.contactUsUnavailable')}</p>
          )}

          {contact?.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3.5 hover:bg-brand-100 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                <Phone className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{t('account.callUs')}</p>
                <p className="text-xs text-gray-500 font-mono" dir="ltr">{contact.phone}</p>
              </div>
            </a>
          )}

          {contact?.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3.5 hover:bg-green-100 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{t('account.whatsappUs')}</p>
                <p className="text-xs text-gray-500 font-mono" dir="ltr">{contact.whatsapp}</p>
              </div>
            </a>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
