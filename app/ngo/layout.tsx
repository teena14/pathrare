'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, HeartHandshake, LayoutDashboard, LogOut, Map, Settings, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { NgoDashboardProvider } from '@/features/ngo/context/ngo-dashboard-context';
import { useTranslation } from 'react-i18next';

export default function NGOLayout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const handleLogout = async () => { await signOut(); router.push('/auth'); };
  const initials = profile?.displayName?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? 'N';

  const NGO_TABS = [
    { href: '/ngo',            label: t('ngo.overview'),    icon: LayoutDashboard },
    { href: '/ngo/map',        label: t('ngo.mapInsights'), icon: Map },
    { href: '/ngo/cases',      label: t('ngo.cases'),       icon: FileText },
    { href: '/ngo/patients',   label: t('ngo.patients'),    icon: HeartHandshake },
    { href: '/ngo/volunteers', label: t('ngo.volunteers'),  icon: Users },
    { href: '/ngo/impact',     label: t('ngo.impact'),      icon: TrendingUp },
  ];

  return (
    <NgoDashboardProvider>
      <div className="theme-page min-h-screen flex flex-col">
        <nav className="sticky top-0 z-50 border-b border-brand-slate-100 bg-white/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/ngo" className="text-xl font-black text-dark-slate">PathRare</Link>
              <div className="hidden md:flex items-center gap-1">
                {NGO_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${active
                        ? 'bg-primary-blue text-white'
                        : 'text-light-slate hover:bg-brand-slate-50 hover:text-primary-blue'
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-primary-blue bg-brand-blue-50 border border-brand-blue-100 px-2.5 py-1 rounded-full">{t('ngo.badge')}</span>
              <Link href="/auth/complete-profile" className="flex items-center gap-1.5 text-xs font-bold text-light-slate hover:text-primary-blue transition-colors">
                <Settings className="w-3.5 h-3.5" />
                {t('ngo.settings')}
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold text-light-slate hover:text-primary-blue transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                {t('ngo.logout')}
              </button>
              <div className="h-8 w-8 rounded-full bg-primary-blue flex items-center justify-center text-white text-xs font-bold">{initials}</div>
            </div>
          </div>
        </nav>
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </NgoDashboardProvider>
  );
}
