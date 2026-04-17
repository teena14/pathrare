'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, HeartHandshake, Users, HeartPulse, UserCircle } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: UserCircle },
  { name: 'Clinical Profile', href: '/dashboard/clinical-profile', icon: Activity },
  { name: 'Life Assist', href: '/dashboard/life-assist', icon: HeartHandshake },
  { name: 'Community', href: '/dashboard/community', icon: Users },
  { name: 'Care', href: '/dashboard/care', icon: HeartPulse },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Persistent Top Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold flex items-center gap-2">
                <span className="text-gradient">PathRare</span>
              </Link>
              <div className="hidden md:flex items-baseline space-x-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-slate-800 text-white' 
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                Logout
              </Link>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-lg">
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
