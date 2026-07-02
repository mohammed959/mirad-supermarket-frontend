'use client';
import { useState, useEffect } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Brand, Category, Product } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: Product | null;
}

/**
 * Phase 3 flat product drawer. Variants are gone — SKU, barcode, price
 * and quantity live directly on the product. Brand is optional and is
 * picked from `/api/brands` (only active brands surface). Sub-category,
 * brand, and the two description fields are optional.
 */
export function ProductDrawer({ open, onClose, onSaved, product }: Props) {
  const isEdit = Boolean(product);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [hideFromHome, setHideFromHome] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load reference data once the drawer first opens.
  useEffect(() => {
    if (!open) return;
    if (categories.length === 0) {
      api.get('/categories?all=true').then((r) => setCategories(r.data.data)).catch(() => {});
    }
    if (brands.length === 0) {
      api.get('/brands').then((r) => setBrands(r.data.data)).catch(() => {});
    }
  }, [open, categories.length, brands.length]);

  // Hydrate form fields whenever the drawer opens for create or edit.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (product) {
      setName(product.name);
      setNameAr(product.nameAr);
      setDescription(product.description ?? '');
      setDescriptionAr(product.descriptionAr ?? '');
      setBrandId(product.brand?.id ?? '');
      setCategoryId(product.category.id);
      setSubcategoryId(product.subcategory?.id ?? '');
      setSku(product.sku ?? '');
      setBarcode(product.barcode ?? '');
      setPrice(product.price != null ? String(product.price) : '');
      setQuantity(String(product.stock ?? 0));
      setIsFeatured(product.isFeatured);
      setIsActive(product.isActive);
      setHideFromHome(Boolean(product.hideFromHome));
    } else {
      setName(''); setNameAr('');
      setDescription(''); setDescriptionAr('');
      setBrandId(''); setCategoryId(''); setSubcategoryId('');
      setSku(''); setBarcode('');
      setPrice(''); setQuantity('0');
      setIsFeatured(false); setIsActive(true); setHideFromHome(false);
    }
  }, [open, product]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Product name is required';
    if (!nameAr.trim()) e.nameAr = 'Arabic name is required';
    // Brand is optional — no validation.
    if (!categoryId) e.categoryId = 'Category is required';
    if (!sku.trim()) e.sku = 'SKU is required';
    if (!price || Number(price) <= 0) e.price = 'Price must be greater than 0';
    if (quantity === '' || Number.isNaN(Number(quantity)) || Number(quantity) < 0) {
      e.quantity = 'Quantity must be 0 or greater';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        description: description.trim() || undefined,
        descriptionAr: descriptionAr.trim() || undefined,
        brandId,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        price: Number(price),
        quantity: Math.floor(Number(quantity)) || 0,
        isFeatured,
        hideFromHome,
      };

      if (isEdit && product) {
        await api.put(`/products/${product.id}`, payload);
        if (isActive !== product.isActive) {
          await api.patch(`/products/${product.id}/status`, { isActive });
        }
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save product';
      const errs = err.response?.data?.errors;
      if (errs) {
        toast.error(errs.map((e: any) => e.message).join(', '));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ─── Basic info ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Basic Info</h3>

            <Input label="Product Name (English) *" placeholder="e.g. Full Fat Milk" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
            <Input label="Product Name (Arabic) *" placeholder="مثال: حليب كامل الدسم" value={nameAr} onChange={(e) => setNameAr(e.target.value)} error={errors.nameAr} dir="rtl" />
            <Input label="Description (English, optional)" placeholder="Short product description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input label="Description (Arabic, optional)" placeholder="وصف موجز للمنتج" value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} dir="rtl" />

            <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 flex gap-2 items-start">
              <ImageIcon className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
              <p className="text-xs text-brand-700 leading-relaxed">
                Product image is loaded from Bunny CDN using the product SKU as the filename.
                Upload as <span className="font-mono">&#123;sku&#125;.png</span>. Missing images
                fall back to the default basket image automatically.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-brand-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">Featured product</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hideFromHome}
                onChange={(e) => setHideFromHome(e.target.checked)}
                className="accent-brand-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Hide from home page "All products"
              </span>
            </label>

            {isEdit && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-brand-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700">Product is visible (active)</span>
              </label>
            )}
          </section>

          {/* ─── Classification ───────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Classification</h3>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Brand (optional)</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(''); }}
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                  errors.categoryId ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{!c.isActive ? ' (inactive)' : ''}</option>
                ))}
              </select>
              {errors.categoryId && <p className="text-xs text-red-600">{errors.categoryId}</p>}
            </div>

            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Subcategory (optional)</label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">No subcategory</option>
                  {selectedCategory.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{!s.isActive ? ' (inactive)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* ─── Inventory & Pricing ──────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inventory &amp; Pricing</h3>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="SKU *"
                placeholder="e.g. MILK-1L"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                error={errors.sku}
              />
              <Input
                label="Barcode (optional)"
                placeholder="e.g. 6281234567890"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price (SAR) *"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                error={errors.price}
              />
              <Input
                label="Quantity *"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                error={errors.quantity}
              />
            </div>
          </section>
        </div>

        <div className="border-t bg-white px-5 py-4 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" loading={loading} onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </div>
    </>
  );
}
