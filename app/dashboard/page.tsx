'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

// Custom Animated Visual Assets
const ClinicalVisual = () => (
  <motion.svg width="80" height="80" viewBox="0 0 100 100" className="drop-shadow-lg">
    <motion.circle cx="50" cy="50" r="40" fill="var(--color-primary-blue)" opacity="0.1"
      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }} />
    <motion.rect x="35" y="30" width="30" height="40" rx="4" fill="var(--color-primary-blue)" 
      initial={{ y: 5 }} animate={{ y: 0 }} transition={{ duration: 2, repeat: Infinity, repeatType: "mirror" }} />
    <circle cx="45" cy="45" r="3" fill="#FFF" />
    <circle cx="55" cy="45" r="3" fill="#FFF" />
    <rect x="40" y="55" width="20" height="4" rx="2" fill="#FFF" />
  </motion.svg>
);

const AssistVisual = () => (
  <motion.svg width="80" height="80" viewBox="0 0 100 100" className="drop-shadow-lg">
    <motion.path d="M50 15 L85 30 L85 60 C85 80 50 95 50 95 C50 95 15 80 15 60 L15 30 Z" fill="var(--color-pacific-blue)" opacity="0.15" />
    <motion.path d="M50 25 L75 37 L75 57 C75 72 50 85 50 85 C50 85 25 72 25 57 L25 37 Z" fill="var(--color-pacific-blue)"
      animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }} transition={{ duration: 4, repeat: Infinity }} />
    <circle cx="50" cy="55" r="10" fill="#FFF" />
    <path d="M45 55 L55 55 M50 50 L50 60" stroke="var(--color-pacific-blue)" strokeWidth="3" strokeLinecap="round" />
  </motion.svg>
);

const CommunityVisual = () => (
  <motion.svg width="80" height="80" viewBox="0 0 100 100" className="drop-shadow-lg">
    <circle cx="50" cy="50" r="40" fill="var(--color-medium-purple)" opacity="0.1" />
    <motion.circle cx="35" cy="45" r="12" fill="var(--color-medium-purple)" opacity="0.8" animate={{ y: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity }} />
    <motion.circle cx="65" cy="45" r="12" fill="var(--color-cornflower)" animate={{ y: [2, -2, 2] }} transition={{ duration: 2, repeat: Infinity }} />
    <motion.circle cx="50" cy="65" r="14" fill="var(--color-primary-blue)" animate={{ y: [-1, 1, -1] }} transition={{ duration: 2.5, repeat: Infinity }} />
  </motion.svg>
);

const CareVisual = () => (
  <motion.svg width="80" height="80" viewBox="0 0 100 100" className="drop-shadow-lg">
    <circle cx="50" cy="50" r="40" fill="var(--color-cornflower)" opacity="0.1" />
    <motion.path d="M50 35 C50 35 40 20 25 30 C10 40 20 60 50 80 C80 60 90 40 75 30 C60 20 50 35 50 35 Z" fill="var(--color-cornflower)"
      animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
  </motion.svg>
);

export default function DashboardPage() {
  const cards = [
    { title: 'Clinical Profile', desc: 'Build your structured clinical identity.', Visual: ClinicalVisual, href: '/dashboard/clinical-profile', color: 'border-primary-blue/20 bg-primary-blue/5 hover:border-primary-blue hover:bg-primary-blue/10 hover:shadow-primary-blue/20' },
    { title: 'Life Assist', desc: 'Connect to NGOs, schemes, and help.', Visual: AssistVisual, href: '/dashboard/life-assist', color: 'border-pacific-blue/20 bg-pacific-blue/5 hover:border-pacific-blue hover:bg-pacific-blue/10 hover:shadow-pacific-blue/20' },
    { title: 'Community', desc: 'Find and interact with families like yours.', Visual: CommunityVisual, href: '/dashboard/community', color: 'border-medium-purple/20 bg-medium-purple/5 hover:border-medium-purple hover:bg-medium-purple/10 hover:shadow-medium-purple/20' },
    { title: 'Care', desc: '24/7 guidance grounded in medical protocols.', Visual: CareVisual, href: '/dashboard/care', color: 'border-cornflower/20 bg-cornflower/5 hover:border-cornflower hover:bg-cornflower/10 hover:shadow-cornflower/20' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary-blue to-cornflower flex items-center justify-center text-2xl font-bold text-white shadow-xl mb-2">
          G
        </div>
        <h1 className="text-4xl font-bold text-dark-slate tracking-tight">Welcome back, Guest</h1>
        <p className="text-light-slate text-lg max-w-xl">
          Your digital companion for daily navigation. What would you like to focus on today?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {cards.map((card, i) => {
          const Visual = card.Visual;
          return (
            <motion.div key={card.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Link href={card.href} className="block group">
                <div className={`glass rounded-[2rem] p-8 border-2 transition-all duration-300 shadow-lg flex items-center gap-6 ${card.color}`}>
                  <div className="shrink-0">
                    <Visual />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-dark-slate mb-2 transition-colors">{card.title}</h2>
                    <p className="text-light-slate text-sm font-medium leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
