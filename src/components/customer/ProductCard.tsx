'use client';
import { Plus } from 'lucide-react';
import { ProductImage } from '@/components/common/ProductImage';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { useCartStore } from '@/stores/cartStore';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { formatPrice, cn } from '@/lib/utils';
import { FavoriteButton } from './FavoriteButton';
import { QuantityStepper } from '@/components/ui/QuantityStepper';

interface ProductCardProps {
  product: Product;
}

function productAvailable(p: Product): boolean {
  if (p.available != null) return p.available;
  if (!p.isActive) return false;
  const stock = p.stock ?? 0;
  const reserved = p.reserved ?? 0;
  return stock - reserved > 0;
}

/** Click handler that swallows the event before it bubbles to the card. */
function stop(e: React.MouseEvent | React.KeyboardEvent) {
  e.stopPropagation();
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const t = useTranslations('products');
  const locale = useLocale();
  const items = useCartStore((s) => s.items);
  const addProduct = useCartStore((s) => s.addProduct);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const openDetail = () => router.push(`/product-details/${product.id}`);

  const displayName = pickLocalized(product, locale);
  const available = productAvailable(product);
  // Exact-inventory branch: only compute a client-side cap when BOTH
  // `stock` and `reserved` are real numbers on the emitting endpoint.
  // Aggregate-mode cards leave both `null` — pass `undefined` to
  // `<QuantityStepper>` so no fabricated ceiling is exposed. The
  // backend still enforces real stock at checkout.
  const hasKnownStock =
    typeof product.stock === 'number' && typeof product.reserved === 'number';
  const maxQty = hasKnownStock
    ? Math.max(0, (product.stock as number) - (product.reserved as number))
    : undefined;
  // Cart is product-keyed end-to-end.
  const cartItem = items.find((i) => i.productId === product.id);

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!available) return;
    addProduct(product);
  };

  // The whole card is clickable. Inner interactive controls (add, stepper,
  // favourite) stop propagation so they don't navigate.
  const handleCardKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleCardKey}
      aria-label={displayName}
      className="
        group relative flex h-full flex-col rounded-3xl bg-white shadow-soft overflow-hidden
        cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300
      "
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] w-full bg-gray-50 overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-contain transition-transform group-hover:scale-105"
        />

        {!available && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <span className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white">
              {t('outOfStock')}
            </span>
          </div>
        )}

        {/* Favorite — stops propagation inside its own handler */}
        <FavoriteButton productId={product.id} className="absolute top-2 end-2 z-10" />

        {/* Floating add button — overlaps the image bottom-end corner */}
        {available && !cartItem && (
          <motion.button
            type="button"
            onClick={handleAdd}
            aria-label={t('addToCart')}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className="
              absolute bottom-1.5 end-1.5 z-10
              flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center
              rounded-full bg-white text-brand-600 shadow-card
              hover:bg-brand-50 transition-colors
            "
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
          </motion.button>
        )}

        {available && cartItem && (
          <div
            onClick={stop}
            onMouseDown={stop}
            className="absolute bottom-1.5 end-1.5 z-10 rounded-full bg-white shadow-card"
          >
            <QuantityStepper
              size="sm"
              value={cartItem.quantity}
              max={maxQty}
              onChange={(q) => updateQuantity(product.id, q)}
            />
          </div>
        )}
      </div>

      {/* Info — flex-1 so every card body fills its grid cell uniformly */}
      <div className="flex flex-1 flex-col gap-1 px-2 py-2 sm:gap-1.5 sm:px-3 sm:py-2.5">
        {/* Brand intentionally hidden in marketplace product cards. */}
        <p className="text-[12px] sm:text-sm font-semibold text-gray-900 line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.5rem]">
          {displayName}
        </p>

        {/* Price pinned to the bottom of the body */}
        <div className="mt-auto flex items-baseline gap-1.5 pt-0.5">
          <span className={cn(
            'text-sm sm:text-base font-bold',
            available ? 'text-brand-600' : 'text-gray-400'
          )}>
            {product.price != null ? formatPrice(product.price) : '—'}
          </span>
          {!available && (
            <span className="text-[10px] sm:text-xs text-gray-400">{t('unavailable')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
