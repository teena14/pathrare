'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, HeartHandshake, Users, HeartPulse, Microscope, LogOut, ArrowLeft, Settings } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffect } from 'react';
import LanguagePicker from '@/components/ui/LanguagePicker';
import { useT } from '@/hooks/use-t';

// ── 5 constant tabs — always shown ───────────────────────────────────────────
const NAV = [
  { name: 'Diagnose',         tKey: 'diagnose',        href: '/patient/diagnose',         icon: Microscope },
  { name: 'Life Assist',      tKey: 'lifeAssist',      href: '/patient/life-assist',      icon: HeartHandshake },
  { name: 'Care',             tKey: 'care',            href: '/patient/care',             icon: HeartPulse },
  { name: 'Community',        tKey: 'community',       href: '/patient/community',        icon: Users },
  { name: 'Clinical Profile', tKey: 'clinicalProfile', href: '/patient/clinical-profile', icon: Activity },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut, profile, loading } = useAuth();
  const router = useRouter();
  const t = useT('nav');

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!profile) { router.replace('/auth'); return; }
    if (!profile.isProfileComplete) { router.replace('/auth/complete-profile'); return; }
    if (profile.role && profile.role !== 'patient') {
      const roleMap: Record<string, string> = {
        ngo: '/ngo', volunteer: '/volunteer',
      };
      router.replace(roleMap[profile.role] ?? '/auth');
    }
  }, [loading, profile, router]);

  if (loading || !profile?.isProfileComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-8 h-8 border-4 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => { await signOut(); router.push('/auth'); };
  const initials = profile?.displayName?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? 'P';
  const isOnTab = pathname !== '/patient';

  return (
    <div className="min-h-screen flex flex-col bg-surface-50">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-surface-200 bg-white/90 backdrop-blur-md ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">

            {/* Logo */}
            <Link href="/patient" className="text-lg font-black tracking-tight shrink-0 mr-1">
              <span className="text-gradient">PathRare</span>
            </Link>

            {/* 5 tabs — always present, left-aligned next to logo */}
            <div className="flex items-center gap-0.5">
              {NAV.map(item => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/patient' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${active
                      ? 'bg-primary-blue text-white'
                      : 'text-light-slate hover:bg-surface-100 hover:text-dark-slate'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t(item.tKey)}</span>
                  </Link>
                );
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right: logout + avatar */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-light-slate hover:text-dark-slate transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('logout')}</span>
            </button>
            <Link
              href="/auth/complete-profile"
              className="flex items-center gap-1.5 text-xs font-bold text-light-slate hover:text-dark-slate transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('settings')}</span>
            </Link>
            <LanguagePicker />
            <div className="h-7 w-7 rounded-full bg-primary-blue flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
        pathname.startsWith('/patient/care')
          ? 'flex flex-col min-h-0 overflow-hidden py-0'
          : 'py-6'
      }`}>

        {/* Back to Dashboard — hide on Care tab (chat fills full height) */}
        {isOnTab && !pathname.startsWith('/patient/care') && (
          <Link
            href="/patient"
            className="inline-flex items-center gap-2 mb-6 text-xs font-bold text-light-slate hover:text-primary-blue transition-colors group"
          >
            <span className="w-6 h-6 rounded-lg bg-surface-100 group-hover:bg-primary-blue/10 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </span>
            {t('backToDashboard')}
          </Link>
        )}

        {children}
      </main>
    </div>
  );
}
