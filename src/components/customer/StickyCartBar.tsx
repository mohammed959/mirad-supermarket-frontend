'use client';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice } from '@/lib/utils';

export function StickyCartBar() {
  const t = useTranslations('cart');
  const router = useRouter();
  const pathname = usePathname();
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());

  // Don't double-render the floating pill on /cart or /checkout — those
  // pages already render their own primary action footer.
  const hide =
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/product-details');
  if (hide) return null;

  const goToCart = () => router.push('/cart');

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          key="sticky-cart"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="md:hidden fixed inset-x-4 bottom-20 z-sticky pointer-events-none"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goToCart}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-3xl bg-brand-500 px-4 py-3 text-white shadow-pop hover:bg-brand-600 transition-colors"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
              <ShoppingCart className="h-5 w-5 text-brand-600" />
              <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-xs font-bold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </div>

            <div className="flex-1 text-start">
              <p className="text-xs opacity-90 leading-tight">{itemCount} {itemCount === 1 ? t('item') : t('items')}</p>
              <p className="text-sm font-bold leading-tight">{t('viewCart')}</p>
            </div>

            <div className="flex items-center gap-2">
              <p className="text-base font-bold">{formatPrice(subtotal)}</p>
              <div className="flex h-8 items-center justify-center rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                {t('cart.checkoutShort') ?? t('viewCart')}
              </div>
            </div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
