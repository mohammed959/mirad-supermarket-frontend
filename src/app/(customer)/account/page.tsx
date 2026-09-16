'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Package, Star, LogOut, ChevronRight, Heart, RotateCcw, MapPin, Settings } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

export default function AccountPage() {
  const t = useTranslations();
  const { user, isAuthenticated, logout } = useCustomerAuthStore();
  const router = useRouter();

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
        {links.map(({ icon: Icon, label, href }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <Icon className="h-4 w-4 text-brand-500" />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
            <ChevronRight className="h-4 w-4 text-gray-400 rtl:rotate-180" />
          </Link>
        ))}
      </div>

      {/* The account page belongs to the customer scope. Staff roles cannot
          reach this customer session anymore — staff sign in independently at
          /admin/login — so there are no role-specific portal shortcuts here. */}

      <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50" onClick={() => { logout(); router.push('/'); }}>
        <LogOut className="h-4 w-4" />
        {t('auth.signOut')}
      </Button>
    </div>
  );
}
