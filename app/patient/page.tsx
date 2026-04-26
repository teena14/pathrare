'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/use-t';

// ── Animated visuals — design-system palette only (#0F5DE3, #23323D, #42596A) ─

const DiagnoseVisual = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <motion.circle cx="28" cy="28" r="18" stroke="#0F5DE3" strokeWidth="2" strokeDasharray="6 3"
      animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
    <motion.circle cx="28" cy="28" r="8" fill="#0F5DE3" opacity="0.12"
      animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
    <circle cx="28" cy="28" r="4" fill="#0F5DE3" />
    <motion.circle cx="28" cy="10" r="3" fill="#0F5DE3" opacity="0.5"
      animate={{ cy: [10, 46, 10] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
  </svg>
);

const LifeAssistVisual = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    {[0, 1, 2].map(i => (
      <motion.rect key={i} x={10 + i * 14} y={28} width="10" rx="3"
        fill="#0F5DE3" opacity={0.3 + i * 0.3}
        animate={{ height: [8, 16 + i * 8, 8], y: [44 - 8, 44 - (16 + i * 8), 44 - 8] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }} />
    ))}
    <motion.line x1="10" y1="14" x2="46" y2="14" stroke="#0F5DE3" strokeWidth="1.5"
      strokeDasharray="4 2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 1.5, repeat: Infinity, repeatType: 'loop', ease: 'linear' }} />
  </svg>
);

const ClinicalVisual = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <motion.polyline
      points="8,44 18,30 26,36 36,18 46,24"
      stroke="#0F5DE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} />
    {[18, 26, 36].map((x, i) => (
      <motion.circle key={i} cx={x} cy={[30, 36, 18][i]} r="3" fill="#0F5DE3"
        animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }} />
    ))}
  </svg>
);

const CommunityVisual = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    {/* Central node */}
    <circle cx="28" cy="28" r="5" fill="#0F5DE3" />
    {/* Satellite nodes */}
    {[0, 72, 144, 216, 288].map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const nx = 28 + 16 * Math.cos(rad);
      const ny = 28 + 16 * Math.sin(rad);
      return (
        <g key={i}>
          <motion.line x1="28" y1="28" x2={nx} y2={ny}
            stroke="#0F5DE3" strokeWidth="1.5" opacity="0.3"
            animate={{ opacity: [0.2, 0.7, 0.2] }} transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }} />
          <motion.circle cx={nx} cy={ny} r="3.5" fill="#0F5DE3" opacity="0.6"
            animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }} />
        </g>
      );
    })}
  </svg>
);

const CareVisual = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <motion.path
      d="M28 42 C28 42 10 32 10 22 C10 16 14 12 20 12 C24 12 28 16 28 16 C28 16 32 12 36 12 C42 12 46 16 46 22 C46 32 28 42 28 42Z"
      fill="#0F5DE3" opacity="0.15"
      stroke="#0F5DE3" strokeWidth="2"
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.path
      d="M24 22 L28 26 L34 18"
      stroke="#0F5DE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.8, delay: 0.5, repeat: Infinity, repeatDelay: 1.5 }} />
  </svg>
);

// ── Card data — keys match dashboard translations ────────────────────────────
const CARD_KEYS = [
  { titleKey: 'cardDiagnoseTitle',  descKey: 'cardDiagnoseDesc',   href: '/patient/diagnose',          Visual: DiagnoseVisual },
  { titleKey: 'cardLifeAssistTitle',descKey: 'cardLifeAssistDesc',  href: '/patient/life-assist',       Visual: LifeAssistVisual },
  { titleKey: 'cardClinicalTitle',  descKey: 'cardClinicalDesc',    href: '/patient/clinical-profile',  Visual: ClinicalVisual },
  { titleKey: 'cardCommunityTitle', descKey: 'cardCommunityDesc',   href: '/patient/community',         Visual: CommunityVisual },
  { titleKey: 'cardCareTitle',      descKey: 'cardCareDesc',        href: '/patient/care',              Visual: CareVisual },
];

// ── Stagger config ─────────────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientHomePage() {
  const { profile } = useAuth();
  const t = useT('dashboard');
  const name = (profile as any)?.firstName ?? profile?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-10">

      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}>

        <h1 className="text-4xl font-black text-dark-slate tracking-tight leading-tight mt-7">
          {t('welcome')}<span className="text-primary-blue">{name}</span>
        </h1>
        <p className="text-light-slate font-medium mt-2 text-base">{t('subtitle')}</p>
      </motion.div>

      {/* Cards — 2-col grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {CARD_KEYS.map((card) => {
          const { Visual } = card;
          return (
            <motion.div key={card.titleKey} variants={cardVariant}>
              <Link href={card.href} className="group block h-full">
                <motion.div
                  whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(15,93,227,0.12)' }}
                  transition={{ duration: 0.2 }}
                  className="h-full bg-white rounded-3xl border border-surface-200 p-7 flex items-start gap-5 hover:border-primary-blue/30 transition-colors"
                >
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center group-hover:border-primary-blue/20 group-hover:bg-primary-blue/5 transition-all">
                    <Visual />
                  </div>
                  <div className="pt-1">
                    <h2 className="font-bold text-dark-slate text-lg mb-1 group-hover:text-primary-blue transition-colors">
                      {t(card.titleKey)}
                    </h2>
                    <p className="text-light-slate text-sm font-medium leading-relaxed">{t(card.descKey)}</p>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
        {CARD_KEYS.length % 2 !== 0 && (
          <div className="hidden sm:block" />
        )}
      </motion.div>

    </div>
  );
}
