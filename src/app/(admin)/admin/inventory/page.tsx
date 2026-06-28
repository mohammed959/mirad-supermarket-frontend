'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { ProductImage } from '@/components/common/ProductImage';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Search, Plus, Minus } from 'lucide-react';
import api from '@/lib/api';
import { Pagination, Product } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { formatPrice, cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

type Tab = 'low' | 'all';

export default function AdminInventoryPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>('low');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.inventory')}</h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {([
          { key: 'low', label: 'Low stock' },
          { key: 'all', label: 'All products' },
        ] as const).map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === entry.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'low' ? <LowStockTab /> : <AllProductsTab />}
    </div>
  );
}

function LowStockTab() {
  const [threshold, setThreshold] = useState(5);
  const { data, isLoading, mutate } = useSWR<Product[]>(
    `/products/low-stock?threshold=${threshold}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="w-32">
          <Input
            label="Threshold"
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
          />
        </div>
        <p className="text-xs text-gray-500 pb-3">
          Products with stock ≤ {threshold} units
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nothing critical"
          description="All active products are above the threshold."
        />
      ) : (
        <ProductStockTable products={data} onMutate={() => mutate()} />
      )}
    </div>
  );
}

function AllProductsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    limit: '20',
    all: 'true',
    includeOutOfStock: 'true',
    ...(search && { q: search }),
  });

  const { data, isLoading, mutate } = useSWR<{ products: Product[]; pagination: Pagination }>(
    `/products?${params}`,
    fetcher
  );

  const products = data?.products ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : products.length === 0 ? (
        <EmptyState title="No products" />
      ) : (
        <>
          <ProductStockTable products={products} onMutate={() => mutate()} />
          {data?.pagination && data.pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-xs text-gray-500">{page} / {data.pagination.pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductStockTable({ products, onMutate }: { products: Product[]; onMutate: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const adjust = async (p: Product, delta: number) => {
    setBusy(p.id);
    try {
      await api.patch(`/products/${p.id}/stock`, { delta });
      await onMutate();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Adjust failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stock / Reserved</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Available</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Adjust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map((p) => {
            const stock = p.stock ?? 0;
            const reserved = p.reserved ?? 0;
            const available = stock - reserved;
            const critical = available <= 0;
            const low = !critical && available <= 5;
            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/products`} className="flex items-center gap-3 min-w-0">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <ProductImage src={p.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                    </div>
                    <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.sku ?? '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-brand-600">
                  {p.price != null ? formatPrice(p.price) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">{stock}</span>
                  {reserved > 0 && <span className="ml-1 text-gray-400">/ {reserved}</span>}
                </td>
                <td className={cn(
                  'px-4 py-2.5 text-right text-sm font-bold',
                  critical ? 'text-red-600' : low ? 'text-amber-600' : 'text-gray-900'
                )}>
                  <span className="inline-flex items-center gap-1">
                    {critical && <AlertTriangle className="h-3.5 w-3.5" />}
                    {available}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => adjust(p, -1)}
                      disabled={busy === p.id || stock === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => adjust(p, +1)}
                      disabled={busy === p.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <BulkAdjust product={p} onDone={onMutate} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BulkAdjust({ product, onDone }: { product: Product; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState('0');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const d = parseInt(delta);
    if (!Number.isFinite(d) || d === 0) return setOpen(false);
    setLoading(true);
    try {
      await api.patch(`/products/${product.id}/stock`, { delta: d });
      onDone();
      toast.success(`Adjusted by ${d > 0 ? `+${d}` : d}`);
      setOpen(false);
      setDelta('0');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Adjust failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="ms-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
      >
        Set
      </button>
      {open && (
        <div className="absolute end-0 z-10 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="±N"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <Button size="sm" className="mt-2 w-full" loading={loading} onClick={submit}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
