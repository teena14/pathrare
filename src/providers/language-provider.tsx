'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type LangCode =
  | 'en' | 'hi' | 'ta' | 'mr' | 'te' | 'bn' | 'kn' | 'gu' | 'pa' | 'or'  // Indian
  | 'ar' | 'fr' | 'es' | 'zh' | 'de' | 'pt';                                 // Global

export const LANGUAGES: { code: LangCode; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',    native: 'English',    flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी',       flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil',      native: 'தமிழ்',       flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi',    native: 'मराठी',       flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',     native: 'తెలుగు',      flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali',    native: 'বাংলা',       flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',    native: 'ಕನ್ನಡ',       flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati',   native: 'ગુજરાતી',     flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi',    native: 'ਪੰਜਾਬੀ',      flag: '🇮🇳' },
  { code: 'or', label: 'Odia',       native: 'ଓଡ଼ିଆ',       flag: '🇮🇳' },
  { code: 'ar', label: 'Arabic',     native: 'العربية',    flag: '🇸🇦' },
  { code: 'fr', label: 'French',     native: 'Français',   flag: '🇫🇷' },
  { code: 'es', label: 'Spanish',    native: 'Español',    flag: '🇪🇸' },
  { code: 'zh', label: 'Chinese',    native: '中文',         flag: '🇨🇳' },
  { code: 'de', label: 'German',     native: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', native: 'Português',  flag: '🇧🇷' },
];

const STORAGE_KEY = 'preferredLanguage';

interface LanguageContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');

  // Load from localStorage and sync i18next on mount
  useEffect(() => {
    import('../lib/i18n').then(({ default: i18n }) => {
      const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved);
        if (i18n.language !== saved) i18n.changeLanguage(saved);
      }
    });
  }, []);

  const setLang = (newLang: LangCode) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    // Sync with i18next
    import('../lib/i18n').then(({ default: i18n }) => {
      i18n.changeLanguage(newLang);
    });
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
