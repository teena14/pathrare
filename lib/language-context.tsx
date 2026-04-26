'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type LangCode = 'en' | 'hi' | 'ta' | 'mr' | 'te' | 'bn' | 'kn' | 'gu' | 'pa' | 'or';

export const LANGUAGES: { code: LangCode; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',    native: 'English',    flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',      native: 'हिंदी',       flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil',      native: 'தமிழ்',       flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi',    native: 'मराठी',       flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',     native: 'తెలుగు',      flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali',    native: 'বাংলা',       flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',    native: 'ಕನ್ನಡ',       flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati',   native: 'ગુજરાતી',     flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi',    native: 'ਪੰਜਾਬੀ',      flag: '🇮🇳' },
  { code: 'or', label: 'Odia',       native: 'ଓଡ଼ିଆ',       flag: '🇮🇳' },
];

const STORAGE_KEY = 'pathrare_lang';

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

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved);
      }
    } catch {
      // localStorage unavailable (SSR or privacy mode)
    }
  }, []);

  const setLang = (newLang: LangCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {}
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
