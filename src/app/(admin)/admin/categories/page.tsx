'use client';
import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Plus, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Pencil, Upload, Home, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { Category, Subcategory } from '@/types';
import { useLocale, pickLocalized } from '@/i18n/useLocale';
import { Button } from '@/components/ui/Button';
import { CategoryImage } from '@/components/common/CategoryImage';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CategoryDrawer } from '@/components/admin/CategoryDrawer';
import { SubcategoryDrawer } from '@/components/admin/SubcategoryDrawer';
import { CategoryImportPanel } from '@/components/admin/CategoryImportPanel';

const fetcher = (url: string) => api.get(url).then((r) => r.data.data);

export default function AdminCategoriesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading, mutate } = useSWR<Category[]>('/categories/admin?all=true', fetcher);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showImport, setShowImport] = useState(false);
  const [catDrawer, setCatDrawer] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const [subDrawer, setSubDrawer] = useState(false);
  const [subParent, setSubParent] = useState<Category | null>(null);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);

  const categories = data ?? [];

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const toggleCategory = async (c: Category) => {
    try {
      await api.put(`/categories/${c.id}`, { isActive: !c.isActive });
      await mutate();
      toast.success(`Category ${!c.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update category');
    }
  };

  const toggleHome = async (c: Category) => {
    try {
      await api.put(`/categories/${c.id}`, { showOnHome: !c.showOnHome });
      await mutate();
      toast.success(!c.showOnHome ? t('admin.shownOnHome') : t('admin.hiddenFromHome'));
    } catch {
      toast.error('Failed to update category');
    }
  };

  const toggleSubcategory = async (c: Category, s: Subcategory) => {
    try {
      await api.put(`/categories/${c.id}/subcategories/${s.id}`, { isActive: !s.isActive });
      await mutate();
      toast.success(`Subcategory ${!s.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update subcategory');
    }
  };

  const openCreateCategory = () => { setEditingCat(null); setCatDrawer(true); };
  const openEditCategory = (c: Category) => { setEditingCat(c); setCatDrawer(true); };

  const openCreateSub = (c: Category) => { setSubParent(c); setEditingSub(null); setSubDrawer(true); };
  const openEditSub = (c: Category, s: Subcategory) => { setSubParent(c); setEditingSub(s); setSubDrawer(true); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.categories')}</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowImport((v) => !v)}>
            <Upload className="h-4 w-4" />
            {t('admin.import')}
          </Button>
          <Button size="sm" onClick={openCreateCategory}>
            <Plus className="h-4 w-4" />
            {t('admin.categories')}
          </Button>
        </div>
      </div>

      {showImport && <CategoryImportPanel onImported={() => mutate()} />}

      {isLoading ? (
        <PageSpinner />
      ) : categories.length === 0 ? (
        <EmptyState title={t('categories.noCategories')} />
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {categories.map((c) => (
            <div key={c.id} className={c.isActive ? '' : 'opacity-60'}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => toggleExpand(c.id)}
                  className="rounded-md p-1 hover:bg-gray-200 text-gray-500"
                >
                  {expanded[c.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <CategoryImage src={c.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 leading-tight">{pickLocalized(c, locale)}</p>
                  <p className="text-xs text-gray-400 mt-0.5" dir={locale === 'ar' ? 'ltr' : 'rtl'}>
                    {locale === 'ar' ? c.name : c.nameAr}
                  </p>
                </div>

                <span className="text-xs text-gray-400">
                  {c.subcategories.length} sub
                </span>

                <button
                  onClick={() => toggleCategory(c)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                    c.isActive ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {c.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {c.isActive ? t('common.active') : t('common.inactive')}
                </button>

                {/* Home visibility — only meaningful while the category is active */}
                <button
                  onClick={() => toggleHome(c)}
                  disabled={!c.isActive}
                  title={c.showOnHome ? t('admin.shownOnHome') : t('admin.hiddenFromHome')}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                    c.showOnHome ? 'text-brand-600' : 'text-gray-400'
                  }`}
                >
                  {c.showOnHome ? <Home className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span className="hidden sm:inline">
                    {c.showOnHome ? t('admin.onHome') : t('admin.offHome')}
                  </span>
                </button>

                <button
                  onClick={() => openEditCategory(c)}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-brand-600 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              {expanded[c.id] && (
                <div className="bg-gray-50 px-4 py-3 space-y-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subcategories</p>
                    <button
                      onClick={() => openCreateSub(c)}
                      className="flex items-center gap-1 rounded-lg border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Subcategory
                    </button>
                  </div>

                  {c.subcategories.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No subcategories yet.</p>
                  ) : (
                    <div className="divide-y divide-gray-200 rounded-xl bg-white border border-gray-100">
                      {c.subcategories.map((s) => (
                        <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${s.isActive ? '' : 'opacity-60'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-tight">{pickLocalized(s, locale)}</p>
                            <p className="text-xs text-gray-400 mt-0.5" dir={locale === 'ar' ? 'ltr' : 'rtl'}>
                              {locale === 'ar' ? s.name : s.nameAr}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleSubcategory(c, s)}
                            className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                              s.isActive ? 'text-green-600' : 'text-gray-400'
                            }`}
                          >
                            {s.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            {s.isActive ? t('common.active') : t('common.inactive')}
                          </button>
                          <button
                            onClick={() => openEditSub(c, s)}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategoryDrawer
        open={catDrawer}
        onClose={() => { setCatDrawer(false); setEditingCat(null); }}
        onSaved={() => mutate()}
        category={editingCat}
      />

      {subParent && (
        <SubcategoryDrawer
          open={subDrawer}
          onClose={() => { setSubDrawer(false); setEditingSub(null); setSubParent(null); }}
          onSaved={() => mutate()}
          category={subParent}
          subcategory={editingSub}
        />
      )}
    </div>
  );
}
