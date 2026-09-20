import type { Metadata } from 'next';
import { readLocale } from '@/i18n/getMessages';
import { getLegalMarkdown, legalMetadata } from '@/lib/legalDocs';
import { LegalMarkdown } from '@/components/legal/LegalMarkdown';

const SEO_COPY: Record<'en' | 'ar', Metadata> = {
  en: {
    title: 'Privacy Policy | Mirad',
    description: 'Learn how Mirad collects, uses, protects, and processes personal data when you use the Mirad online store.',
  },
  ar: {
    title: 'سياسة الخصوصية | ميراد',
    description: 'تعرف على كيفية جمع متجر ميراد للبيانات الشخصية واستخدامها وحمايتها ومعالجتها عند استخدام المتجر الإلكتروني.',
  },
};

export const generateMetadata = legalMetadata(SEO_COPY);

export default async function PrivacyPolicyPage() {
  const locale = readLocale();
  const markdown = await getLegalMarkdown('privacy&policy', locale);
  return <LegalMarkdown markdown={markdown} locale={locale} />;
}
