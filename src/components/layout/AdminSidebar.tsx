'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings, LogOut, Tag,
  Image as ImageIcon, Sparkles, Boxes, Truck, ClipboardCheck, UserCircle2, Bell,
  Percent, ScrollText, FileSpreadsheet, MapPin, CalendarClock, Award,
} from 'lucide-react';
import { useStaffAuthStore } from '@/stores/staffAuthStore';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { BrandLogo } from '@/components/common/BrandLogo';
import { cn } from '@/lib/utils';

interface Props {
  /** Called when a nav link or logout is activated — used to close the
   *  off-canvas drawer on mobile. No-op on desktop (static sidebar). */
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: Props = {}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useStaffAuthStore();

  const NAV_SECTIONS = [
    {
      heading: t('admin.sectionOperations'),
      items: [
        { href: '/admin',                 icon: LayoutDashboard, label: t('admin.dashboard'), exact: true },
        { href: '/admin/orders',          icon: ShoppingBag,     label: t('admin.orders') },
        { href: '/admin/inventory',       icon: Boxes,           label: t('admin.inventory') },
        { href: '/admin/bulk-sku-update', icon: FileSpreadsheet, label: t('admin.bulkSku') },
      ],
    },
    {
      heading: t('admin.sectionCatalog'),
      items: [
        { href: '/admin/products',           icon: Package,         label: t('admin.products') },
        { href: '/admin/brands',             icon: Award,           label: t('admin.brands') },
        { href: '/admin/categories',         icon: Tag,             label: t('admin.categories') },
        { href: '/admin/banners',            icon: ImageIcon,       label: t('admin.banners') },
        { href: '/admin/featured-sections',  icon: Sparkles,        label: t('admin.featuredSections') },
        { href: '/admin/promotions',         icon: Percent,         label: t('admin.promotions') },
        { href: '/admin/imports',            icon: FileSpreadsheet, label: t('admin.imports') },
      ],
    },
    {
      heading: t('admin.sectionPeople'),
      items: [
        { href: '/admin/customers', icon: UserCircle2,    label: t('admin.customers') },
        { href: '/admin/pickers',   icon: ClipboardCheck, label: t('admin.pickers') },
        { href: '/admin/drivers',   icon: Truck,          label: t('admin.drivers') },
        { href: '/admin/users',     icon: Users,          label: t('admin.allUsers') },
      ],
    },
    {
      heading: t('admin.sectionSettings'),
      items: [
        { href: '/admin/subscriptions',      icon: Sparkles,   label: t('admin.subscriptions') },
        { href: '/admin/branch-coverage',    icon: MapPin,     label: t('admin.branchLocation') },
        { href: '/admin/pickup-reservation', icon: CalendarClock, label: t('admin.pickupReservation') },
        { href: '/admin/notifications',      icon: Bell,       label: t('admin.notifications') },
        { href: '/admin/audit-logs',         icon: ScrollText, label: t('admin.auditLogs') },
        { href: '/admin/settings',           icon: Settings,   label: t('admin.settings') },
      ],
    },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e border-gray-200 bg-white px-3 py-4 gap-3 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-3 mb-1">
        <BrandLogo size="md" priority />
        <p className="text-[10px] text-gray-400 leading-none">{t('admin.dashboard')}</p>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.heading} className="flex flex-col gap-0.5">
          <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {section.heading}
          </p>
          {section.items.map(({ href, icon: Icon, label, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive(href, exact)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive(href, exact) ? 'text-brand-500' : 'text-gray-400')} />
              {label}
            </Link>
          ))}
        </div>
      ))}

      <div className="mt-auto pt-2 space-y-1">
        <div className="px-1">
          <LanguageSwitcher className="w-full justify-center" />
        </div>
        <button
          onClick={() => { onNavigate?.(); logout(); router.push('/admin/login'); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.signOut')}
        </button>
      </div>
    </aside>
  );
}
