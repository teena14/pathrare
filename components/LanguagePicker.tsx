'use client';

import { useState, useRef, useEffect } from 'react';
import { useLang, LANGUAGES, LangCode } from '@/lib/language-context';
import { Globe } from 'lucide-react';

export default function LanguagePicker() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="lang-picker-btn"
        onClick={() => setOpen((o) => !o)}
        title="Change language"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 999,
          border: '1.5px solid #e2e8f0',
          background: open ? '#f1f5f9' : '#fff',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          color: '#475569',
          transition: 'all 0.15s',
        }}
      >
        <Globe size={14} />
        <span>{current.native}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 999,
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 200,
            overflow: 'hidden',
            animation: 'langFadeIn 0.15s ease-out',
          }}
        >
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Choose Language
          </div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              id={`lang-option-${l.code}`}
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 14px',
                border: 'none',
                background: lang === l.code ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                borderLeft: lang === l.code ? '3px solid #0F5DE3' : '3px solid transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => { if (lang !== l.code) (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { if (lang !== l.code) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: lang === l.code ? '#0F5DE3' : '#1e293b' }}>{l.native}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.label}</div>
              </div>
              {lang === l.code && (
                <span style={{ marginLeft: 'auto', fontSize: 16, color: '#0F5DE3' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes langFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
