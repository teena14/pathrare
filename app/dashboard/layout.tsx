'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, HeartHandshake, Users, HeartPulse, UserCircle, Microscope } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: UserCircle },
  { name: 'Diagnose', href: '/dashboard/diagnose', icon: Microscope },
  { name: 'Clinical Profile', href: '/dashboard/clinical-profile', icon: Activity },
  { name: 'Life Assist', href: '/dashboard/life-assist', icon: HeartHandshake },
  { name: 'Community', href: '/dashboard/community', icon: Users },
  { name: 'Care', href: '/dashboard/care', icon: HeartPulse },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      {/* Persistent Top Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-10">
              <Link href="/dashboard" className="text-2xl font-black flex items-center gap-2 tracking-tight">
                <span className="text-gradient">PathRare</span>
              </Link>
              <div className="hidden md:flex items-baseline space-x-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        isActive 
                          ? 'bg-primary-blue text-white shadow-md' 
                          : 'text-light-slate hover:bg-surface-100 hover:text-primary-blue'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm font-bold text-light-slate hover:text-primary-blue transition-colors">
                Logout
              </Link>
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary-blue to-cornflower flex items-center justify-center text-white font-bold shadow-lg ring-4 ring-primary-blue/10">
                G
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
