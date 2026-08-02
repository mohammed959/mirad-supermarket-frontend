'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Category, Product, Promotion, PromotionType, TargetScope } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

const TYPE_OPTIONS: { value: PromotionType; label: string; help: string }[] = [
  { value: 'PRODUCT_DISCOUNT',            label: 'Product discount',       help: '% or fixed off matching products' },
  { value: 'CATEGORY_DISCOUNT',           label: 'Category discount',      help: '% or fixed off everything in a category' },
  { value: 'VARIANT_DISCOUNT',            label: 'Variant discount',       help: '% or fixed off specific variants (matches by category for now)' },
  { value: 'BUY_X_GET_Y',                 label: 'Buy X get Y',            help: 'Add free items for matching purchases' },
  { value: 'SUBSCRIPTION_BASED_DISCOUNT', label: 'Subscription discount',  help: 'Only customers with an active subscription' },
  { value: 'FREE_DELIVERY_THRESHOLD',     label: 'Free delivery threshold',help: 'Managed via Delivery Settings' },
];

const SCOPE_OPTIONS: { value: TargetScope; label: string }[] = [
  { value: 'ALL',         label: 'Everything' },
  { value: 'PRODUCT',     label: 'Specific products' },
  { value: 'CATEGORY',    label: 'Specific categories' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  promotion?: Promotion | null;
}

const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export function PromotionDrawer({ open, onClose, onSaved, promotion }: Props) {
  const isEdit = Boolean(promotion);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PromotionType>('PRODUCT_DISCOUNT');
  const [targetScope, setTargetScope] = useState<TargetScope>('ALL');
  const [isActive, setIsActive] = useState(false);
  const [isStackable, setIsStackable] = useState(false);
  const [priority, setPriority] = useState('0');
  const [startDate, setStartDate] = useState(toDateInput(new Date().toISOString()));
  const [endDate, setEndDate] = useState('');
  const [minimumCartValue, setMinimumCartValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState('');
  const [requiresSubscription, setRequiresSubscription] = useState(false);

  // Config fields per type
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [buyQty, setBuyQty] = useState('2');
  const [getQty, setGetQty] = useState('1');

  // Targets
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());
  const [productQuery, setProductQuery] = useState('');

  const { data: categories } = useSWR<Category[]>(open ? '/categories/admin?all=true' : null, fetcher);
  const { data: products } = useSWR<{ products: Product[] }>(
    open && targetScope === 'PRODUCT' && productQuery.length >= 2
      ? `/products?all=true&includeOutOfStock=true&q=${encodeURIComponent(productQuery)}&limit=20`
      : null,
    fetcher
  );

  useEffect(() => {
    if (!open) return;
    if (promotion) {
      setName(promotion.name);
      setNameAr(promotion.nameAr);
      setDescription(promotion.description ?? '');
      setType(promotion.type);
      setTargetScope(promotion.targetScope);
      setIsActive(promotion.isActive);
      setIsStackable(promotion.isStackable);
      setPriority(String(promotion.priority ?? 0));
      setStartDate(toDateInput(promotion.startDate));
      setEndDate(toDateInput(promotion.endDate));
      setMinimumCartValue(promotion.minimumCartValue != null ? String(promotion.minimumCartValue) : '');
      setUsageLimit(promotion.usageLimit != null ? String(promotion.usageLimit) : '');
      setUsageLimitPerCustomer(promotion.usageLimitPerCustomer != null ? String(promotion.usageLimitPerCustomer) : '');
      setRequiresSubscription(promotion.requiresSubscription);
      setProductIds(new Set(promotion.targetProducts?.map((p) => p.id) ?? []));
      setCategoryIds(new Set(promotion.targetCategories?.map((c) => c.id) ?? []));

      const cfg = promotion.config ?? {};
      setDiscountMode(((cfg as any).mode as 'percent' | 'fixed') ?? 'percent');
      setDiscountValue(String((cfg as any).value ?? 10));
      setBuyQty(String((cfg as any).buyQuantity ?? 2));
      setGetQty(String((cfg as any).getQuantity ?? 1));
    } else {
      setName(''); setNameAr(''); setDescription('');
      setType('PRODUCT_DISCOUNT'); setTargetScope('ALL');
      setIsActive(false); setIsStackable(false); setPriority('0');
      setStartDate(toDateInput(new Date().toISOString())); setEndDate('');
      setMinimumCartValue(''); setUsageLimit(''); setUsageLimitPerCustomer('');
      setRequiresSubscription(false);
      setProductIds(new Set()); setCategoryIds(new Set());
      setDiscountMode('percent'); setDiscountValue('10');
      setBuyQty('2'); setGetQty('1');
    }
  }, [open, promotion]);

  const buildConfig = (): Record<string, unknown> => {
    switch (type) {
      case 'PRODUCT_DISCOUNT':
      case 'CATEGORY_DISCOUNT':
      case 'VARIANT_DISCOUNT':
      case 'SUBSCRIPTION_BASED_DISCOUNT':
        return { mode: discountMode, value: Number(discountValue) || 0 };
      case 'BUY_X_GET_Y':
        return { buyQuantity: Number(buyQty) || 0, getQuantity: Number(getQty) || 0 };
      case 'FREE_DELIVERY_THRESHOLD':
        return {};
    }
  };

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !nameAr.trim()) return toast.error('Name (English + Arabic) is required');
    if (!startDate) return toast.error('Start date is required');
    if (type === 'FREE_DELIVERY_THRESHOLD') {
      return toast.error('Free-delivery threshold is configured under Delivery Settings.');
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        description: description.trim() || undefined,
        type,
        targetScope,
        isActive,
        isStackable,
        priority: parseInt(priority) || 0,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        minimumCartValue: minimumCartValue ? Number(minimumCartValue) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        usageLimitPerCustomer: usageLimitPerCustomer ? parseInt(usageLimitPerCustomer) : null,
        requiresSubscription,
        config: buildConfig(),
        productIds: targetScope === 'PRODUCT' ? Array.from(productIds) : [],
        categoryIds: targetScope === 'CATEGORY' ? Array.from(categoryIds) : [],
      };

      if (isEdit && promotion) {
        await api.put(`/promotions/${promotion.id}`, payload);
        toast.success('Promotion updated');
      } else {
        await api.post('/promotions', payload);
        toast.success('Promotion created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save promotion');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const cats = categories ?? [];
  const productResults = products?.products ?? [];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit promotion' : 'New promotion'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Basics</h3>
            <Input label="Name (English)" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend deal" />
            <Input label="Name (Arabic)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" placeholder="عرض الأسبوع" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description (optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Mechanism</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PromotionType)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">{TYPE_OPTIONS.find((o) => o.value === type)?.help}</p>
            </div>

            {(type === 'PRODUCT_DISCOUNT' || type === 'CATEGORY_DISCOUNT' || type === 'VARIANT_DISCOUNT' || type === 'SUBSCRIPTION_BASED_DISCOUNT') && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-sm font-medium text-gray-700">Mode</label>
                  <select
                    value={discountMode}
                    onChange={(e) => setDiscountMode(e.target.value as 'percent' | 'fixed')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="percent">% percent</option>
                    <option value="fixed">SAR fixed</option>
                  </select>
                </div>
                <Input
                  className="col-span-2"
                  label={`Discount ${discountMode === 'percent' ? '(%)' : '(SAR per unit)'}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            )}

            {type === 'BUY_X_GET_Y' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Buy quantity (X)" type="number" min="1" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} />
                <Input label="Get free (Y)" type="number" min="1" value={getQty} onChange={(e) => setGetQty(e.target.value)} />
              </div>
            )}

            {type === 'FREE_DELIVERY_THRESHOLD' && (
              <p className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                Use <strong>Delivery Settings</strong> to manage the free-delivery threshold.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Target</h3>
            <div className="flex gap-2">
              {SCOPE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTargetScope(s.value)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors',
                    targetScope === s.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-brand-300'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {targetScope === 'CATEGORY' && (
              cats.length === 0
                ? <Skeleton className="h-24" />
                : <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-100 p-2">
                    {cats.map((c) => {
                      const checked = categoryIds.has(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = new Set(categoryIds);
                              checked ? next.delete(c.id) : next.add(c.id);
                              setCategoryIds(next);
                            }}
                            className="accent-brand-500 h-4 w-4"
                          />
                          <span className="text-sm text-gray-700">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
            )}

            {targetScope === 'PRODUCT' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products to add…"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                {productQuery.length >= 2 && productResults.length > 0 && (
                  <ul className="divide-y divide-gray-50 rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
                    {productResults.map((p) => {
                      const checked = productIds.has(p.id);
                      return (
                        <li key={p.id}>
                          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = new Set(productIds);
                                checked ? next.delete(p.id) : next.add(p.id);
                                setProductIds(next);
                              }}
                              className="accent-brand-500 h-4 w-4"
                            />
                            <span className="text-sm text-gray-700 truncate">{p.name}</span>
                            <span className="ms-auto text-xs text-gray-400 truncate">{p.category?.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {productIds.size > 0 && (
                  <p className="text-xs text-gray-500">{productIds.size} product(s) selected</p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Schedule &amp; limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input label="End date (optional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Min cart (SAR)" type="number" min="0" step="0.01" value={minimumCartValue} onChange={(e) => setMinimumCartValue(e.target.value)} />
              <Input label="Total uses" type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
              <Input label="Per customer" type="number" min="0" value={usageLimitPerCustomer} onChange={(e) => setUsageLimitPerCustomer(e.target.value)} />
            </div>
            <Input label="Priority (higher wins first)" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </section>

          <section className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-brand-500 h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">Promotion is active</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isStackable} onChange={(e) => setIsStackable(e.target.checked)} className="accent-brand-500 h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">Stackable with other promotions</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={requiresSubscription} onChange={(e) => setRequiresSubscription(e.target.checked)} className="accent-brand-500 h-4 w-4" />
              <span className="text-sm font-medium text-gray-700">Requires active subscription</span>
            </label>
          </section>
        </div>

        <div className="border-t bg-white px-5 py-4 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1" loading={loading} onClick={handleSubmit}>
            {isEdit ? 'Save changes' : 'Create promotion'}
          </Button>
        </div>
      </div>
    </>
  );
}
