'use client';
import { useState, useEffect, useRef } from 'react';
import { X, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Category, Subcategory } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryImage } from '@/components/common/CategoryImage';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  category: Category;
  subcategory?: Subcategory | null;
}

export function SubcategoryDrawer({ open, onClose, onSaved, category, subcategory }: Props) {
  const isEdit = Boolean(subcategory);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageTouched, setImageTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSlugTouched(false);
    setImageTouched(false);
    if (subcategory) {
      setName(subcategory.name);
      setNameAr(subcategory.nameAr);
      setSlug(subcategory.slug);
      setSortOrder(String(subcategory.sortOrder ?? 0));
      setIsActive(subcategory.isActive);
      setImageUrl(subcategory.imageUrl ?? null);
    } else {
      setName(''); setNameAr(''); setSlug('');
      setSortOrder('0'); setIsActive(true);
      setImageUrl(null);
    }
  }, [open, subcategory]);

  useEffect(() => {
    if (!isEdit && !slugTouched) setSlug(slugify(name));
  }, [name, isEdit, slugTouched]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!nameAr.trim()) e.nameAr = 'Arabic name is required';
    if (!slug.trim()) e.slug = 'Slug is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFilePick = async (files: FileList | null) => {
    const file = files && files[0];
    if (!file) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error('Only JPG, PNG or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ data: { url: string } }>(
        '/uploads/subcategory-image',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setImageUrl(res.data.data.url);
      setImageTouched(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setImageTouched(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        nameAr: nameAr.trim(),
        slug: slug.trim(),
        sortOrder: Number(sortOrder) || 0,
        ...(isEdit && { isActive }),
      };
      // On create: send imageUrl only when one was uploaded.
      // On edit: send imageUrl only if it was changed this session (may be null).
      if (isEdit) {
        if (imageTouched) payload.imageUrl = imageUrl;
      } else if (imageUrl) {
        payload.imageUrl = imageUrl;
      }
      if (isEdit && subcategory) {
        await api.put(`/categories/${category.id}/subcategories/${subcategory.id}`, payload);
        toast.success('Subcategory updated');
      } else {
        await api.post(`/categories/${category.id}/subcategories`, payload);
        toast.success('Subcategory created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save subcategory');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Subcategory' : 'Add Subcategory'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">in {category.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <Input
            label="Name (English)"
            placeholder="e.g. Milk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Name (Arabic)"
            placeholder="مثال: حليب"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            error={errors.nameAr}
            dir="rtl"
          />
          <Input
            label="Slug"
            placeholder="e.g. milk"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            error={errors.slug}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Image (optional)</label>
            <div className="flex items-start gap-3">
              <div className="relative h-20 w-20 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shrink-0">
                {imageUrl ? (
                  <CategoryImage src={imageUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-300">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {imageUrl ? 'Replace' : 'Upload'}
                  </button>
                  {imageUrl && !uploading && (
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">
                  JPG, PNG or WEBP · up to 5 MB. Leave empty to fall back to the default subcategory image.
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              hidden
              onChange={(e) => handleFilePick(e.target.files)}
            />
          </div>

          <Input
            label="Sort order"
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-brand-500 h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">Subcategory is visible (active)</span>
            </label>
          )}
        </div>

        <div className="border-t bg-white px-5 py-4 flex gap-3 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading || uploading}>
            Cancel
          </Button>
          <Button className="flex-1" loading={loading} disabled={uploading} onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create Subcategory'}
          </Button>
        </div>
      </div>
    </>
  );
}
