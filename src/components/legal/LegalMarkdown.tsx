import ReactMarkdown from 'react-markdown';
import { LOCALE_DIR, type Locale } from '@/i18n/config';

/**
 * Tailwind classes for each rendered Markdown element, matching the rest
 * of the site's typography (brand palette, `text-gray-900`/`text-gray-600`
 * body colors) instead of pulling in a separate typography plugin. Shared
 * by every legal document page (Terms & Conditions, Privacy Policy, ...)
 * so they render identically.
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-8 text-lg md:text-xl font-bold text-gray-900 leading-snug first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-6 text-base font-bold text-gray-900">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-3 text-sm md:text-base leading-7 text-gray-600 first:mt-2">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mt-3 list-disc ps-5 space-y-1.5 text-sm md:text-base leading-7 text-gray-600">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mt-3 list-decimal ps-5 space-y-1.5 text-sm md:text-base leading-7 text-gray-600">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700">
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-gray-100" />,
};

/**
 * Reasonable max-width, generous padding, and a card matching the site's
 * other content surfaces — the shared shell every legal document page
 * renders its markdown inside.
 */
export function LegalMarkdown({ markdown, locale }: { markdown: string; locale: Locale }) {
  return (
    <article dir={LOCALE_DIR[locale]} className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-soft md:p-10">
      <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
    </article>
  );
}
