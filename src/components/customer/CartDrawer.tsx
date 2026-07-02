'use client';
import { useRouter } from 'next/navigation';
import { X, Minus, Plus, Trash2, ShoppingBag, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ProductImage } from '@/components/common/ProductImage';
import { useCartStore } from '@/stores/cartStore';
import { useLocale } from '@/i18n/useLocale';
import { useCartItemNames } from '@/hooks/useCartItemNames';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface MinimumOrder {
  enabled: boolean;
  minimumAmount: number | string;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

/**
 * Phase 6: the cart is product-totals only — delivery fee, distance,
 * free-delivery threshold progress, and subscription benefits are all
 * decided at checkout, where the customer's selected address and
 * fulfillment choice come together. The cart only checks the admin's
 * minimum-order rule so the checkout button reflects whether the order
 * is permitted to proceed at all.
 */
export function CartDrawer() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const {
    items, isOpen, closeCart, updateQuantity, removeItem, subtotal,
  } = useCartStore();
  const sub = subtotal();
  const nameFor = useCartItemNames(items);

  const { data: minOrder } = useSWR<MinimumOrder | null>(
    isOpen && items.length > 0 ? '/delivery/minimum-order' : null,
    fetcher,
  );
  const minimumEnabled = Boolean(minOrder?.enabled);
  const minimumAmount = minOrder?.minimumAmount != null ? Number(minOrder.minimumAmount) : 0;
  const belowMinimum = minimumEnabled && minimumAmount > 0 && sub < minimumAmount;

  // `end-0` already mirrors position; mirror the slide direction too.
  const fromX = locale === 'ar' ? '-100%' : '100%';

  const handleCheckout = () => {
    if (belowMinimum) {
      toast.error(t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) }));
      return;
    }
    closeCart();
    router.push('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-drawer bg-black/40 backdrop-blur-sm"
            onClick={closeCart}
          />

          <motion.div
            key="cart-panel"
            initial={{ x: fromX }}
            animate={{ x: 0 }}
            exit={{ x: fromX }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed inset-y-0 end-0 z-drawer flex w-full max-w-sm flex-col bg-white shadow-sheet"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-brand-500" />
                <span className="font-bold text-gray-900">{t('cart.yourCart')}</span>
                {items.length > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {items.reduce((s, i) => s + i.quantity, 0)} {t('cart.items')}
                  </span>
                )}
              </div>
              <button onClick={closeCart} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                    <ShoppingBag className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="font-semibold text-gray-500">{t('cart.empty')}</p>
                  <button onClick={closeCart} className="text-sm text-brand-500 font-medium underline">
                    {t('products.continueShopping')}
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((item) => {
                    const name = nameFor(item);
                    return (
                    <li key={item.productId} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <ProductImage src={item.productImage} alt={name} fill sizes="56px" className="object-cover" />
                      </div>

                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-sm font-bold text-brand-600">{formatPrice(item.price)}</p>
                      </div>

                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => removeItem(item.productId)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label={t('cart.remove')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            aria-label="-"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 hover:bg-brand-600 transition-colors"
                            aria-label="+"
                          >
                            <Plus className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t bg-white px-4 py-4 space-y-3">
                {/* Minimum order warning — blocks the checkout CTA below. */}
                {belowMinimum && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) })}</p>
                  </div>
                )}

                {/* Products total only — delivery is decided at checkout. */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">{t('cart.subtotal')}</span>
                  <span className="text-lg font-bold text-brand-600">{formatPrice(sub)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={belowMinimum}
                  onClick={handleCheckout}
                >
                  {t('cart.checkout')}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
