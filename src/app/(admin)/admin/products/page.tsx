'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Plus, ToggleLeft, ToggleRight, Search, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Product, Pagination } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductDrawer } from '@/components/admin/ProductDrawer';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

function useDebouncedValue<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function AdminProductsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Snap back to page 1 whenever a filter that affects the result set changes.
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    all: 'true',
    ...(debouncedSearch && { q: debouncedSearch }),
  });
  const { data, isLoading, mutate } = useSWR<{ products: Product[]; pagination: Pagination }>(
    `/products?${params}`,
    fetcher,
    { keepPreviousData: true },
  );

  const products = data?.products ?? [];
  const pagination = data?.pagination;
  const totalItems = pagination?.totalItems ?? pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? pagination?.pages ?? 1;

  const firstIdx = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIdx  = Math.min(page * pageSize, totalItems);

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      await api.patch(`/products/${id}/status`, { isActive: !current });
      await mutate();
      toast.success(`Product ${!current ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const toggleHomeVisibility = async (product: Product) => {
    const next = !Boolean(product.hideFromHome);
    try {
      await api.put(`/products/${product.id}`, { hideFromHome: next });
      await mutate();
      toast.success(next ? 'Hidden from home' : 'Visible on home');
    } catch {
      toast.error('Failed to update');
    }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (product: Product) => { setEditing(product); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.products')}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('admin.products')}
        </Button>
      </div>

      {/* Search + page-size */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder={t('admin.productSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-9 pe-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          {t('admin.pageSize')}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            className="rounded-xl border border-gray-200 bg-white py-2 ps-3 pe-7 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        {totalItems > 0 && (
          <p className="text-xs text-gray-500 ms-auto">
            {t('admin.showingRange', { first: firstIdx, last: lastIdx, total: totalItems })}
          </p>
        )}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : products.length === 0 ? (
        <EmptyState title={t('products.noProducts')} />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Home</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => {
                const primary = pickLocalized(product, locale);
                const secondary = locale === 'ar' ? product.name : product.nameAr;
                const priceLabel = product.price != null ? formatPrice(product.price) : '—';
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${!product.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 leading-tight">{primary}</p>
                      <p className="text-xs text-gray-400 mt-0.5" dir={locale === 'ar' ? 'ltr' : 'rtl'}>{secondary}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.brand ? pickLocalized(product.brand, locale) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pickLocalized(product.category, locale)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{product.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-600">{priceLabel}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{product.stock}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(product.id, product.isActive)}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                          product.isActive ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {product.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        {product.isActive ? t('common.active') : t('common.inactive')}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleHomeVisibility(product)}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                          !product.hideFromHome ? 'text-green-600' : 'text-gray-400'
                        }`}
                        title="Toggle visibility in home page All-products"
                      >
                        {!product.hideFromHome ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        {!product.hideFromHome ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(product)} className="text-brand-600 text-xs font-semibold hover:underline">{t('admin.edit')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-xs text-gray-500">
                {t('admin.pageOf', { page, total: totalPages })}
                {' · '}
                {t('admin.totalProducts', { count: totalItems })}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm" variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  aria-label={t('admin.firstPage')}
                  title={t('admin.firstPage')}
                >
                  <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  size="sm" variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t('common.previous')}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  size="sm" variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t('common.next')}
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  size="sm" variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  aria-label={t('admin.lastPage')}
                  title={t('admin.lastPage')}
                >
                  <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <ProductDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSaved={() => mutate()}
        product={editing}
      />
    </div>
  );
}
