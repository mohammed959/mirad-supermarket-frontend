'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { ProductImage } from '@/components/common/ProductImage';
import { useTranslations } from 'next-intl';
import { Trash2, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { useCartItemNames } from '@/hooks/useCartItemNames';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Card } from '@/components/ui/Card';

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
export default function CartPage() {
  const t = useTranslations();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const nameFor = useCartItemNames(items);

  const { data: minOrder } = useSWR<MinimumOrder | null>(
    items.length > 0 ? '/delivery/minimum-order' : null,
    fetcher,
  );
  const minimumEnabled = Boolean(minOrder?.enabled);
  const minimumAmount = minOrder?.minimumAmount != null ? Number(minOrder.minimumAmount) : 0;
  const belowMinimum = minimumEnabled && minimumAmount > 0 && subtotal < minimumAmount;

  const handleCheckout = () => {
    if (belowMinimum) {
      toast.error(t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) }));
      return;
    }
    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <ShoppingBag className="h-12 w-12 text-brand-400" />
        <p className="font-semibold text-gray-700">{t('cart.empty')}</p>
        <Link href="/">
          <Button>{t('cart.startShopping')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-lg font-bold text-gray-900">{t('cart.yourCart')}</h1>

      {/* Minimum order warning — blocks both the desktop + mobile CTAs. */}
      {belowMinimum && (
        <Card tone="default" shadow="soft" pad="md" className="flex items-start gap-2 text-sm font-medium text-amber-800 border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{t('checkout.minimumOrder', { amount: formatPrice(minimumAmount) })}</p>
        </Card>
      )}

      {/* Items */}
      <Card tone="default" shadow="soft" pad="none">
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const name = nameFor(item);
            return (
            <li key={item.productId} className="flex gap-3 p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                <ProductImage src={item.productImage} alt={name} fill sizes="64px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                  {name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-bold text-brand-600">{formatPrice(Number(item.price) * item.quantity)}</p>
                  <QuantityStepper
                    size="sm"
                    value={item.quantity}
                    onChange={(q) => updateQuantity(item.productId, q)}
                  />
                </div>
              </div>
              <button
                onClick={() => removeItem(item.productId)}
                aria-label={t('cart.remove')}
                className="self-start rounded-full p-1.5 text-gray-400 hover:bg-danger-50 hover:text-danger-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
            );
          })}
        </ul>
      </Card>

      {/* Products total only — delivery is decided at checkout. */}
      <Card tone="default" shadow="soft" pad="md" className="flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-700">{t('cart.subtotal')}</span>
        <span className="text-lg font-bold text-brand-600">{formatPrice(subtotal)}</span>
      </Card>

      {/* Desktop / inline checkout CTA */}
      <div className="hidden md:block">
        <Button
          className="w-full"
          size="lg"
          disabled={belowMinimum}
          onClick={handleCheckout}
        >
          {t('cart.checkout')} · {formatPrice(subtotal)}
        </Button>
      </div>

      {/* Mobile sticky checkout footer */}
      <div className="md:hidden fixed inset-x-0 bottom-16 z-sticky px-4 pb-3 pointer-events-none">
        <button
          type="button"
          onClick={handleCheckout}
          disabled={belowMinimum}
          className={`
            pointer-events-auto flex w-full items-center justify-between
            rounded-3xl px-5 py-3.5 text-white shadow-pop transition-colors
            ${belowMinimum
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600'}
          `}
        >
          <div className="text-start">
            <p className="text-xs opacity-80 leading-tight">{items.length} {items.length === 1 ? t('cart.item') : t('cart.items')}</p>
            <p className="text-lg font-bold leading-tight">{formatPrice(subtotal)}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-1.5 text-sm font-bold">
            {t('cart.checkout')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </span>
        </button>
      </div>
    </div>
  );
}
