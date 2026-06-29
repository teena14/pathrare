'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useLang, LANGUAGES } from '@/providers/language-provider';

export default function LanguagePicker() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const isRTL = lang === 'ar';

  return (
    <div ref={ref} className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
      <button
        id="language-picker-btn"
        aria-label="Select language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-200 text-sm font-bold text-dark-slate transition-all"
      >
        <Globe className="w-4 h-4 text-primary-blue" />
        <span className="hidden sm:inline">{current.flag} {current.native}</span>
        <span className="sm:hidden">{current.flag}</span>
        <svg className={`w-3.5 h-3.5 text-light-slate transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Language options"
          className="absolute top-full mt-2 right-0 z-50 w-56 bg-white rounded-2xl shadow-xl border border-surface-200 p-1.5 max-h-80 overflow-y-auto"
        >
          {/* Indian languages group */}
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-light-slate">
            Indian Languages
          </div>
          {LANGUAGES.filter((l) => ['en','hi','ta','mr','te','bn','kn','gu','pa','or'].includes(l.code)).map((l) => (
            <LangOption key={l.code} lang={l} active={lang === l.code} onSelect={() => { setLang(l.code); setOpen(false); }} />
          ))}

          <div className="my-1 border-t border-surface-100" />

          {/* Global languages group */}
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-light-slate">
            Global Languages
          </div>
          {LANGUAGES.filter((l) => ['ar','fr','es','zh','de','pt'].includes(l.code)).map((l) => (
            <LangOption key={l.code} lang={l} active={lang === l.code} onSelect={() => { setLang(l.code); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function LangOption({
  lang,
  active,
  onSelect,
}: {
  lang: (typeof LANGUAGES)[0];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
        active
          ? 'bg-primary-blue text-white font-bold'
          : 'text-dark-slate hover:bg-surface-50 font-medium'
      }`}
    >
      <span className="text-base leading-none">{lang.flag}</span>
      <span className="flex-1 text-start">{lang.native}</span>
      {active && (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}
