'use client';
import { useLang } from '@/providers/language-provider';
import { nav } from '@/lib/i18n/nav';
import { dashboard } from '@/lib/i18n/dashboard';
import { care } from '@/lib/i18n/care';
import { diagnose } from '@/lib/i18n/diagnose';
import { lifeAssist, clinicalProfile } from '@/lib/i18n/pages';

const namespaces: Record<string, Record<string, Record<string, string>>> = {
  nav, dashboard, care, diagnose, lifeAssist, clinicalProfile,
};

/**
 * useT('namespace') — returns a translator function t('key')
 * Falls back to English if translation is missing.
 *
 * Usage:
 *   const t = useT('nav');
 *   <span>{t('diagnose')}</span>
 */
export function useT(namespace: string) {
  const { lang } = useLang();
  const ns = namespaces[namespace] ?? {};
  return (key: string): string => {
    const entry = ns[key];
    if (!entry) return key;
    return entry[lang] ?? entry['en'] ?? key;
  };
}
