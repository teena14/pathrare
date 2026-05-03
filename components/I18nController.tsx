'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/i18n';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Syncs document.documentElement.dir and lang with the active i18next language.
 * Mount this once inside the root layout (client-side only).
 */
export default function I18nController() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const isRTL = RTL_LANGS.has(lng);
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    };

    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => { i18n.off('languageChanged', apply); };
  }, [i18n]);

  return null;
}
