'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { ProductImage } from '@/components/common/ProductImage';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  Plus, ToggleLeft, ToggleRight, Pencil, Trash2, ArrowUp, ArrowDown, Search, X,
} from 'lucide-react';
import api from '@/lib/api';
import { FeaturedSection, Product } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function AdminFeaturedSectionsPage() {
  const t = useTranslations();
  const { data, isLoading, mutate } = useSWR<FeaturedSection[]>(
    '/featured-sections?all=true',
    fetcher
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedSection | null>(null);
  const [pickerSection, setPickerSection] = useState<FeaturedSection | null>(null);

  const sections = data ?? [];

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit   = (s: FeaturedSection) => { setEditing(s); setDrawerOpen(true); };

  const toggle = async (s: FeaturedSection) => {
    try {
      await api.patch(`/featured-sections/${s.id}/status`, { isActive: !s.isActive });
      await mutate();
      toast.success(`Section ${!s.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update');
    }
  };

  const remove = async (s: FeaturedSection) => {
    if (!confirm(`Delete section "${s.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/featured-sections/${s.id}`);
      await mutate();
      toast.success('Section deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const reorderSection = async (s: FeaturedSection, delta: -1 | 1) => {
    try {
      await api.put(`/featured-sections/${s.id}`, { sortOrder: (s.sortOrder ?? 0) + delta });
      await mutate();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const removeItem = async (sectionId: string, productId: string) => {
    try {
      await api.delete(`/featured-sections/${sectionId}/products/${productId}`);
      await mutate();
    } catch {
      toast.error('Failed to remove product');
    }
  };

  const reorderItem = async (sectionId: string, itemId: string, delta: -1 | 1) => {
    try {
      await api.patch(`/featured-sections/${sectionId}/items/${itemId}/reorder`, { delta });
      await mutate();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.featuredSections')}</h1>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add section
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : sections.length === 0 ? (
        <EmptyState
          title="No sections yet"
          description="Group related products into a strip and assign them to a section."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add section</Button>}
        />
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div
              key={s.id}
              className={cn(
                'rounded-2xl border bg-white p-4',
                s.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500" dir="rtl">{s.nameAr}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-xs text-gray-500">
                  <button onClick={() => reorderSection(s, -1)} className="rounded-md p-1 hover:bg-gray-100">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[10px]">{s.sortOrder ?? 0}</span>
                  <button onClick={() => reorderSection(s, 1)} className="rounded-md p-1 hover:bg-gray-100">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => toggle(s)}
                  className={cn(
                    'flex items-center gap-1 text-xs font-semibold',
                    s.isActive ? 'text-green-600' : 'text-gray-400'
                  )}
                >
                  {s.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {s.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => openEdit(s)}
                  aria-label="Edit"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(s)}
                  aria-label="Delete"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Members */}
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Products ({s.items.length})
                </p>
                <button
                  onClick={() => setPickerSection(s)}
                  className="flex items-center gap-1 rounded-lg border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                >
                  <Plus className="h-3 w-3" /> Add products
                </button>
              </div>

              {s.items.length === 0 ? (
                <p className="text-xs text-gray-400 py-3">No products in this section yet.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {s.items.map((it) => (
                    <div key={it.id} className="relative shrink-0 w-32 rounded-xl border border-gray-100 bg-gray-50 p-2">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white mb-1.5">
                        <ProductImage src={it.product.imageUrl} altSrc={it.product.imageUrlAlt} fallbackSrc={it.product.imageUrlFallback} alt="" fill sizes="128px" className="object-cover" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">
                        {it.product.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => reorderItem(s.id, it.id, -1)} className="rounded p-0.5 hover:bg-white">
                            <ArrowUp className="h-3 w-3 text-gray-500" />
                          </button>
                          <button onClick={() => reorderItem(s.id, it.id, 1)} className="rounded p-0.5 hover:bg-white">
                            <ArrowDown className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(s.id, it.productId)}
                          aria-label="Remove"
                          className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SectionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={() => mutate()}
        section={editing}
      />

      {pickerSection && (
        <ProductPickerDrawer
          section={pickerSection}
          onClose={() => setPickerSection(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}

function SectionDrawer({
  open, onClose, onSaved, section,
}: { open: boolean; onClose: () => void; onSaved: () => void; section: FeaturedSection | null }) {
  const isEdit = Boolean(section);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (section) {
      setName(section.name);
      setNameAr(section.nameAr);
      setSortOrder(String(section.sortOrder ?? 0));
      setIsActive(section.isActive);
    } else {
      setName(''); setNameAr(''); setSortOrder('0'); setIsActive(true);
    }
  }, [open, section]);

  const reset = () => { setName(''); setNameAr(''); setSortOrder('0'); setIsActive(true); };

  const handleSubmit = async () => {
    if (!name.trim() || !nameAr.trim()) return toast.error('Name (English + Arabic) is required');
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        sortOrder: Number(sortOrder) || 0,
        ...(isEdit && { isActive }),
      };
      if (isEdit && section) {
        await api.put(`/featured-sections/${section.id}`, payload);
        toast.success('Section updated');
      } else {
        await api.post('/featured-sections', payload);
        toast.success('Section created');
      }
      onSaved();
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save section');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => { reset(); onClose(); }} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit section' : 'Add section'}</h2>
          <button onClick={() => { reset(); onClose(); }} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <Input label="Name (English)" value={name} onChange={(e) => setName(e.target.value)} placeholder="Trending now" />
          <Input label="Name (Arabic)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" placeholder="الأكثر طلباً" />
          <Input label="Sort order" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-brand-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">Section is visible (active)</span>
            </label>
          )}
        </div>
        <div className="border-t bg-white px-5 py-4 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={() => { reset(); onClose(); }} disabled={loading}>Cancel</Button>
          <Button className="flex-1" loading={loading} onClick={handleSubmit}>
            {isEdit ? 'Save changes' : 'Create section'}
          </Button>
        </div>
      </div>
    </>
  );
}

function ProductPickerDrawer({
  section, onClose, onSaved,
}: { section: FeaturedSection; onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams({
    limit: '40',
    all: 'true',
    includeOutOfStock: 'true',
    ...(search && { q: search }),
  });
  const { data, isLoading } = useSWR<{ products: Product[] }>(
    `/products?${params}`,
    fetcher
  );

  const existing = new Set(section.items.map((i) => i.productId));
  const products = data?.products ?? [];

  const toggle = (id: string) => {
    if (existing.has(id)) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const save = async () => {
    if (selected.size === 0) return onClose();
    setSaving(true);
    try {
      await api.post(`/featured-sections/${section.id}/products`, {
        productIds: Array.from(selected),
      });
      toast.success(`Added ${selected.size} product(s)`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to add products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Add products</h2>
            <p className="text-xs text-gray-500 mt-0.5">to "{section.name}"</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="border-b px-5 py-3 shrink-0 space-y-1.5">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-9 pe-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <p className="text-[10px] text-gray-400 px-1">Type 2+ chars — matches name, Arabic name, SKU or barcode.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : products.length === 0 ? (
            <EmptyState title="No products" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {products.map((p) => {
                const inSection = existing.has(p.id);
                const isSel = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      disabled={inSection}
                      className={cn(
                        'flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors',
                        inSection ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
                        isSel && 'bg-brand-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={isSel || inSection}
                        disabled={inSection}
                        className="accent-brand-500 h-4 w-4"
                      />
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        <ProductImage src={p.imageUrl} altSrc={p.imageUrlAlt} fallbackSrc={p.imageUrlFallback} alt={p.name} fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{p.category?.name}</span>
                          {p.variants[0]?.sku && (
                            <span className="font-mono text-[10px] rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 shrink-0">
                              {p.variants[0].sku}{p.variants.length > 1 && ` +${p.variants.length - 1}`}
                            </span>
                          )}
                        </div>
                      </div>
                      {inSection && (
                        <span className="text-[10px] uppercase tracking-wide text-gray-400">In section</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t bg-white px-5 py-4 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" loading={saving} onClick={save} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>
    </>
  );
}
