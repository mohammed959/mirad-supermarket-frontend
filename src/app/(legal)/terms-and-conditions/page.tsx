import type { Metadata } from 'next';
import { readLocale } from '@/i18n/getMessages';
import { getLegalMarkdown, legalMetadata } from '@/lib/legalDocs';
import { LegalMarkdown } from '@/components/legal/LegalMarkdown';

const SEO_COPY: Record<'en' | 'ar', Metadata> = {
  en: {
    title: 'Terms & Conditions | Mirad',
    description: 'Read the terms and conditions governing the use of the Mirad online store and its services.',
  },
  ar: {
    title: 'الشروط والأحكام | ميراد',
    description: 'اطلع على الشروط والأحكام المنظمة لاستخدام متجر ميراد الإلكتروني وخدماته.',
  },
};

export const generateMetadata = legalMetadata(SEO_COPY);

export default async function TermsAndConditionsPage() {
  const locale = readLocale();
  const markdown = await getLegalMarkdown('terms&conditions', locale);
  return <LegalMarkdown markdown={markdown} locale={locale} />;
}
