import { LegalHeader } from '@/components/legal/LegalHeader';
import { BottomNav } from '@/components/customer/BottomNav';

/**
 * Shared shell for every legal document page (Terms & Conditions, Privacy
 * Policy, ...) — a route group, so this one file backs all of them without
 * affecting their URLs. Deliberately its own (light) layout rather than the
 * `(customer)` route group's — that group wraps every page in
 * `MarketplaceGate`/`LocationGate` (branch-configured / choose-a-location
 * checks) and cart chrome, none of which should ever stand between a
 * customer and a legal document.
 *
 * Uses `LegalHeader` (logo + language switcher only) instead of the site's
 * usual `CustomerHeader` — the deliver-to chip, cart button, and search bar
 * aren't relevant while reading a legal document. This is scoped to these
 * two pages only; `CustomerHeader` itself, and every other page that uses
 * it, is untouched.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <LegalHeader />
      <main className="mx-auto max-w-screen-xl px-4 py-4 pb-24 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
