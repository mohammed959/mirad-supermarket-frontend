'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useStaffAuthStore } from '@/stores/staffAuthStore';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { BrandLogo } from '@/components/common/BrandLogo';
import { PageSpinner } from '@/components/ui/Spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useStaffAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === '/admin/login';
  // Wait for Zustand to rehydrate from localStorage before checking auth
  const [hydrated, setHydrated] = useState(false);
  // Mobile off-canvas sidebar toggle.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hydrated || isLoginRoute) return;
    if (!isAuthenticated) {
      router.push('/admin/login');
    } else if (user && user.role !== 'SUPER_ADMIN') {
      // Non-admin staff get bounced to their own portal, NOT to the customer
      // storefront — the two scopes are isolated.
      router.push(user.role === 'PICKER' ? '/picker' : user.role === 'DRIVER' ? '/driver' : '/admin/login');
    }
  }, [hydrated, isAuthenticated, user, router, isLoginRoute]);

  // Login route renders standalone (no sidebar, no auth gate).
  if (isLoginRoute) return <>{children}</>;

  // Show spinner while hydrating or before user is confirmed
  if (!hydrated || !user) return <PageSpinner />;
  if (user.role !== 'SUPER_ADMIN') return <PageSpinner />;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Static sidebar on desktop */}
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>

      {/* Off-canvas sidebar on mobile/tablet */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 start-0 flex shadow-2xl">
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Content column. min-w-0 lets wide tables scroll instead of
          stretching the layout. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo size="md" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
