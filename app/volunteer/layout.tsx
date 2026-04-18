'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ListTodo, BarChart2, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { name: 'Dashboard',  href: '/volunteer',          icon: LayoutDashboard },
  { name: 'Task Feed',  href: '/volunteer/tasks',     icon: ListTodo },
  { name: 'Stats',      href: '/volunteer/stats',     icon: BarChart2 },
];

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const router = useRouter();
  const handleLogout = async () => { await signOut(); router.push('/auth'); };
  const initials = profile?.displayName?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? 'V';
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <nav className="sticky top-0 z-50 border-b border-surface-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/volunteer" className="text-xl font-black text-gradient">PathRare</Link>
            <div className="hidden md:flex items-center gap-1">
              {NAV.map(item => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.name} href={item.href} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${active ? 'bg-amber-500 text-white' : 'text-light-slate hover:bg-surface-100 hover:text-amber-600'}`}>
                    <Icon className="w-3.5 h-3.5" />{item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">Volunteer</span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold text-light-slate hover:text-rose-500 transition-colors"><LogOut className="w-3.5 h-3.5" /> Logout</button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
          </div>
        </div>
      </nav>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
