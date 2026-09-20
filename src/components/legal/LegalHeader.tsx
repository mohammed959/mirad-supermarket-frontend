import Link from 'next/link';
import { BrandLogo } from '@/components/common/BrandLogo';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

/**
 * Minimal header for legal document pages (Terms & Conditions, Privacy
 * Policy) — logo + language switcher only. These pages don't need the
 * deliver-to chip, cart button, or search bar from `CustomerHeader`, but
 * should still look like part of the same site, so this mirrors its
 * sticky/background/padding conventions. `CustomerHeader` itself is left
 * completely untouched — every other page keeps it exactly as it was.
 */
export function LegalHeader() {
  return (
    <header className="sticky top-0 z-nav bg-gray-50 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center shrink-0" aria-label="Mirad">
          <BrandLogo size="sm" priority />
        </Link>
        <LanguageSwitcher variant="icon" />
      </div>
    </header>
  );
}
