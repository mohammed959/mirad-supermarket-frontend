import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';
import { readLocale } from '@/i18n/getMessages';
import type { Locale } from '@/i18n/config';

/**
 * Shared loader for every legal document (Terms & Conditions, Privacy
 * Policy, ...). Each one lives in its own project-root content folder
 * (`terms&conditions/`, `privacy&policy/`, ...) as a `{ar,en}.md` pair —
 * that pair is the single source of truth for the wording. Never edit
 * them from here; only read them.
 */

/**
 * Some source files are already well-formed CommonMark (blank-line-
 * separated blocks, real `#`/`##` headings, `*` bullets) and need no
 * adjustment — trimming still leaves an internal blank line, so this
 * returns immediately. Others are plain prose with no blank lines at all
 * (every line runs into the next), which CommonMark would otherwise
 * collapse into a single run-on paragraph with no visible heading
 * hierarchy. For that case only, this promotes the first line to a level-1
 * heading, promotes "<number>. <title>" section-label lines to level-2
 * headings, and gives every other line its own paragraph — all purely
 * structural. Not one word of the legal text is added, removed, or
 * reworded.
 */
export function normalizeMarkdown(raw: string): string {
  const trimmed = raw.trim();
  if (/\n[ \t]*\n/.test(trimmed)) return trimmed;

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (i === 0) {
      out.push(`# ${line}`);
    } else if (/^\d+\.\s+\S/.test(line)) {
      out.push(`## ${line}`);
    } else {
      out.push(line);
    }
    out.push('');
  });
  return out.join('\n').trim();
}

/**
 * Reads and normalizes a legal document's markdown for one locale.
 * `folder` is the project-root content directory, e.g. `'terms&conditions'`
 * or `'privacy&policy'`.
 */
export async function getLegalMarkdown(folder: string, locale: Locale): Promise<string> {
  const filePath = path.join(process.cwd(), folder, `${locale}.md`);
  const raw = await readFile(filePath, 'utf8');
  return normalizeMarkdown(raw);
}

/**
 * Turns a `{ar: {...}, en: {...}}` SEO copy map into a `generateMetadata`
 * export — every legal page needs exactly this and nothing more.
 */
export function legalMetadata(copy: Record<Locale, Metadata>) {
  return function generateMetadata(): Metadata {
    return copy[readLocale()];
  };
}
