'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function getRoleDashboard(role: string | null): string {
  const map: Record<string, string> = {
    patient: '/patient', ngo: '/ngo', volunteer: '/volunteer',
    coordinator: '/coordinator', hospital: '/hospital', doctor: '/doctor',
  };
  return role ? (map[role] ?? '/auth') : '/auth';
}

export default function DashboardRedirect() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) { router.replace('/auth'); return; }
    if (!profile.isProfileComplete) { router.replace('/auth/complete-profile'); return; }
    router.replace(getRoleDashboard(profile.role));
  }, [profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary-blue/20 border-t-primary-blue rounded-full animate-spin" />
        <p className="text-light-slate font-medium text-sm">Redirecting to your dashboard…</p>
      </div>
    </div>
  );
}
