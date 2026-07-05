import { CustomerHeader } from '@/components/layout/CustomerHeader';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { BottomNav } from '@/components/customer/BottomNav';
import { StickyCartBar } from '@/components/customer/StickyCartBar';
import { MarketplaceGate } from '@/components/customer/MarketplaceGate';
import { LocationGate } from '@/components/customer/LocationGate';
import { LocationLoginAdopter } from '@/components/customer/LocationLoginAdopter';
import { SplashGate } from '@/components/customer/SplashGate';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* First-visit brand splash (shows once, not on refresh) */}
      <SplashGate />
      {/* Saves a gate-validated location as the customer's default after login */}
      <LocationLoginAdopter />
      <CustomerHeader />
      <main className="mx-auto max-w-screen-xl px-4 py-4 pb-32 md:pb-8">
        <MarketplaceGate>
          <LocationGate>{children}</LocationGate>
        </MarketplaceGate>
      </main>
      <CartDrawer />
      <StickyCartBar />
      <BottomNav />
    </div>
  );
}
