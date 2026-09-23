'use client';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/common/ProductImage';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Plus, Minus, ChevronRight, Heart } from 'lucide-react';
import api from '@/lib/api';
import { MarketplaceProduct } from '@/types';
import { useCartStore } from '@/stores/cartStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useCustomerAuthStore } from '@/stores/customerAuthStore';
import { useLocale } from '@/i18n/useLocale';
import { formatPrice, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

function productAvailable(p: MarketplaceProduct): boolean {
  if (p.available != null) return p.available;
  if (!p.isActive) return false;
  return (p.stock ?? 0) - (p.reserved ?? 0) > 0;
}

export default function ProductDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  // POST /products/detail with { id, lang }. String SWR key encodes both so
  // SSR + client hash identically and lang changes evict the cached detail.
  const { data: product, isLoading, error } = useSWR<MarketplaceProduct>(
    `/products/detail?id=${params.id}&lang=${locale}`,
    () => api.post('/products/detail', { id: params.id, lang: locale }).then((r) => r.data.data),
  );

  const items = useCartStore((s) => s.items);
  const addProduct = useCartStore((s) => s.addProduct);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const isAuth = useCustomerAuthStore((s) => s.isAuthenticated);
  const isFav = useFavoritesStore((s) => product ? s.ids.has(product.id) : false);
  const toggleFav = useFavoritesStore((s) => s.toggle);

  if (isLoading) {
    return (
      <div className="-mx-4 -my-4 min-h-screen bg-gray-50 px-4 py-4 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="font-semibold text-gray-700">{t('products.noProducts')}</p>
        <Link href="/" className="inline-block rounded-2xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  // MarketplaceProduct returns a single localized `name` / `description`
  // per the request `lang`; there is no opposite-language subtitle anymore.
  const productName = product.name;
  const description = product.description;
  const categoryName    = product.category?.name ?? '';
  const subcategoryName = product.subcategory?.name ?? '';
  const brandName       = product.brand?.name ?? null;

  const cartItem = items.find((i) => i.productId === product.id);
  const available = productAvailable(product);

  const handleShare = async () => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator;
    if (typeof nav.share === 'function') {
      try { await nav.share({ title: productName, url: window.location.href }); }
      catch { /* user cancelled */ }
      return;
    }
    if (nav.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(window.location.href);
        toast.success('Link copied');
      } catch { /* ignore */ }
    }
  };

  const handleFav = async () => {
    if (!isAuth) {
      toast(t('auth.signInToFavorite'));
      router.push('/login');
      return;
    }
    try { await toggleFav(product.id); } catch { /* ignore */ }
  };

  const requireAuth = () => {
    if (isAuth) return true;
    toast(t('auth.signInToShop'));
    router.push('/login');
    return false;
  };

  const handleAdd = () => {
    if (!available) return;
    if (!requireAuth()) return;
    const action = cartItem
      ? updateQuantity(product.id, cartItem.quantity + 1)
      : addProduct(product);
    action
      .then(() => toast.success(t('products.addToCart')))
      .catch((err) => toast.error(err.response?.data?.message ?? t('cart.updateFailed')));
  };

  const handleStep = (nextQuantity: number) => {
    if (!requireAuth()) return;
    updateQuantity(product.id, nextQuantity).catch((err) => {
      toast.error(err.response?.data?.message ?? t('cart.updateFailed'));
    });
  };

  return (
    // Break out of the parent's px-4/py-4 so we can paint the page fully.
    <div className="-mx-4 -my-4 min-h-screen bg-gray-50 pb-8">
      {/* Top bar: back / breadcrumb / share */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-soft hover:shadow-card transition-shadow active:scale-95"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700 rtl:rotate-180" />
        </button>

        <nav aria-label="breadcrumb" className="flex-1 overflow-hidden">
          <ol className="flex items-center justify-center gap-1.5 text-xs text-gray-500 truncate">
            <li>
              <Link href="/categories" className="hover:text-gray-700">{t('categories.allCategories')}</Link>
            </li>
            {categoryName && (
              <>
                <ChevronRight className="h-3 w-3 text-gray-300 shrink-0 rtl:rotate-180" />
                <li>
                  <Link href={`/product-list/${product.categoryId}`} className="hover:text-gray-700 truncate">
                    {categoryName}
                  </Link>
                </li>
              </>
            )}
            {subcategoryName && (
              <>
                <ChevronRight className="h-3 w-3 text-gray-300 shrink-0 rtl:rotate-180" />
                <li>
                  <Link
                    href={`/product-list/${product.categoryId}?sub=${product.subcategoryId ?? ''}`}
                    className="hover:text-gray-700 truncate font-semibold text-gray-700"
                  >
                    {subcategoryName}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Share"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-soft hover:shadow-card transition-shadow active:scale-95"
        >
          <Share2 className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Hero: image on top on mobile (full width), side-by-side on sm+ */}
      <section className="px-4 mb-6">
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-start">
          {/* Image */}
          <div className="sm:col-span-5">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-white shadow-soft p-3">
              <ProductImage
                src={product.imageUrl}
                altSrc={product.imageUrlAlt}
                fallbackSrc={product.imageUrlFallback}
                alt={productName}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 40vw, 320px"
                className="object-contain p-2"
                priority
              />
              {!available && (
                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm">
                  <span className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white">
                    {t('products.outOfStock')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="sm:col-span-7 flex flex-col gap-3 sm:pt-1">
            <div>
              {brandName && (
                <p className="text-[11px] uppercase tracking-wider font-semibold text-brand-600">
                  {brandName}
                </p>
              )}
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                {productName}
              </h1>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                {product.price != null ? formatPrice(product.price) : '—'}
              </span>
            </div>

            <div className="mt-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Found in</p>
              <Link
                href={`/product-list/${product.categoryId}`}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {categoryName}{subcategoryName ? ` · ${subcategoryName}` : ''}
              </Link>
            </div>

            {/* Quick actions — placed at the top so customers don't need to
                scroll down to add to cart or favourite. The CTA morphs into a
                live stepper once the item is in the cart. */}
            <div className="flex items-center gap-2 mt-1">
              {cartItem && available ? (
                <div className="flex flex-1 items-center justify-between gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-1.5 py-1 text-white shadow-soft">
                  <motion.button
                    type="button"
                    onClick={() => handleStep(cartItem.quantity - 1)}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                    aria-label="−"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                  </motion.button>
                  <div className="flex-1 text-center leading-none">
                    <span className="text-base font-black">{cartItem.quantity}</span>
                    <span className="ms-1 text-[10px] font-semibold opacity-80">
                      {cartItem.quantity === 1 ? t('cart.item') : t('cart.items')}
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => handleStep(cartItem.quantity + 1)}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                    aria-label="+"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleAdd}
                  disabled={!available}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-soft transition-colors',
                    available
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  {available ? t('products.addToCart') : t('products.outOfStock')}
                </motion.button>
              )}
              <button
                type="button"
                onClick={handleFav}
                aria-label={t('nav.favorites')}
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-soft transition-colors',
                  isFav ? 'bg-danger-50 text-danger-600' : 'bg-white text-gray-600 hover:bg-brand-50'
                )}
              >
                <Heart className={cn('h-4 w-4', isFav && 'fill-danger-500 text-danger-500')} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About this product */}
      {description && (
        <section className="mx-4 mb-4 rounded-3xl bg-white p-5 shadow-soft">
          <h2 className="font-bold text-gray-900 mb-2">{t('products.description')}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        </section>
      )}
    </div>
  );
}
