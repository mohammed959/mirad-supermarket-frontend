'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, X,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
}

interface CategoryImportSummary {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  categoriesCreated: number;
  categoriesReused: number;
  subcategoriesCreated: number;
  errors: ImportError[];
  resultFile: string;
  resultFileName: string;
}

/** Decode a base64 string to a Blob without pulling in an extra dependency. */
function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Bulk-import categories + subcategories from an Excel sheet. Mirrors the
 * product-import UX. Calls `onImported` after a successful run so the parent
 * list can refresh.
 */
export function CategoryImportPanel({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CategoryImportSummary | null>(null);

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/categories/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'category-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const onSelect = (f: File | null) => {
    if (!f) return setFile(null);
    if (!/\.xlsx?$/i.test(f.name)) {
      toast.error('Pick an .xlsx file');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File is larger than 10 MB');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const submit = async () => {
    if (!file) return toast.error('Choose a file first');
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<{ data: CategoryImportSummary; message: string }>(
        '/categories/import/excel',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResult(res.data.data);
      toast.success(res.data.message ?? 'Import complete');
      onImported?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
      {/* Step 1 — template */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-brand-500" />
          <h2 className="font-semibold text-gray-900">Import categories &amp; subcategories</h2>
        </div>
        <p className="text-sm text-gray-600">
          One row per <strong>category + optional subcategory</strong>. Repeat the same category on
          multiple rows to add several subcategories. A category is matched to an existing one by its
          <strong> Arabic name</strong> (extra spacing ignored) — a match reuses it as-is; no match creates
          it. Subcategories are always created, even if the name is already used elsewhere.
          <code>status</code> TRUE = active, FALSE = inactive (blank = active).
        </p>
        <Button variant="secondary" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Download template
        </Button>
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer font-semibold">Column reference</summary>
          <ul className="ml-4 mt-2 list-disc space-y-0.5">
            <li><code>category_name_en</code>, <code>category_name_ar</code> — required</li>
            <li><code>category_sort</code> — whole number (default 0)</li>
            <li><code>category_status</code> — TRUE / FALSE (default TRUE)</li>
            <li><code>subcategory_name_en</code>, <code>subcategory_name_ar</code> — optional, but both required together</li>
            <li><code>subcategory_sort</code> — whole number (default 0)</li>
            <li><code>sub_category_status</code> — TRUE / FALSE (default TRUE)</li>
          </ul>
        </details>
      </div>

      {/* Step 2 — upload */}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2">
          <FileSpreadsheet className="h-5 w-5 text-brand-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-800 truncate">{file.name}</p>
            <p className="text-xs text-brand-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="rounded-md p-1 text-brand-500 hover:bg-brand-100"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 hover:border-brand-300 hover:bg-brand-50 transition-colors"
        >
          <Upload className="h-4 w-4" /> Click to pick an .xlsx file (max 10 MB)
        </button>
      )}

      <Button className="w-full" loading={uploading} disabled={!file} onClick={submit}>
        <Upload className="h-4 w-4" /> Run import
      </Button>

      {/* Result */}
      {result && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <h3 className="font-semibold text-gray-900">Result</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <Tile label="Rows" value={result.totalRows} />
            <Tile label="Succeeded" value={result.successfulRows} color="green" />
            <Tile label="Failed" value={result.failedRows} color={result.failedRows > 0 ? 'red' : 'gray'} />
            <Tile label="Cat. created" value={result.categoriesCreated} color="green" />
            <Tile label="Cat. reused" value={result.categoriesReused} />
            <Tile label="Sub created" value={result.subcategoriesCreated} color="green" />
          </div>

          {result.resultFile && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const blob = base64ToBlob(
                  result.resultFile,
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.resultFileName || 'category-import-result.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Download result file
            </Button>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-sm font-semibold text-amber-800">{result.errors.length} row error(s)</p>
              <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 rounded border border-amber-100 bg-white px-2 py-1.5">
                    {e.rowNumber > 0 && (
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                        Row {e.rowNumber}
                      </span>
                    )}
                    {e.field && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-700">
                        {e.field}
                      </span>
                    )}
                    <span className="text-amber-800">{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, color = 'gray' }: { label: string; value: number; color?: 'gray' | 'green' | 'red' }) {
  const tone = color === 'green'
    ? { border: 'border-green-100', bg: 'bg-green-50', text: 'text-green-700' }
    : color === 'red'
      ? { border: 'border-red-100', bg: 'bg-red-50', text: 'text-red-700' }
      : { border: 'border-gray-100', bg: 'bg-gray-50', text: 'text-gray-500' };
  return (
    <div className={`rounded-xl border p-2 ${tone.border} ${tone.bg}`}>
      <p className={`text-[10px] ${tone.text}`}>{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${color === 'gray' ? 'text-gray-900' : tone.text}`}>{value}</p>
    </div>
  );
}
