'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { AlertTriangle, Users, ClipboardList, TrendingUp } from 'lucide-react';

// ── Leaflet must be dynamically imported (no SSR) ─────────────────────────────
const Map = dynamic(() => import('./HeatMap'), { ssr: false, loading: () => (
  <div className="w-full h-full bg-surface-100 rounded-2xl flex items-center justify-center">
    <div className="text-light-slate text-sm font-medium animate-pulse">Loading map…</div>
  </div>
) });

// ── Types ─────────────────────────────────────────────────────────────────────
type SubRole = 'asha' | 'government' | 'admin';

const SUBROLE_LABELS: Record<SubRole, string> = {
  asha:       'ASHA / Social Worker',
  government: 'Government Official',
  admin:      'Platform Admin',
};

// ── Mock cluster data ─────────────────────────────────────────────────────────
const CLUSTERS = [
  { id: 'c1', region: 'Mumbai',    district: 'Dharavi',      needs: 24, crises: 3, resources: 2, lat: 19.039,  lng: 72.855,  intensity: 0.95 },
  { id: 'c2', region: 'Pune',      district: 'Hadapsar',     needs: 18, crises: 1, resources: 5, lat: 18.508,  lng: 73.928,  intensity: 0.72 },
  { id: 'c3', region: 'Nashik',    district: 'Igatpuri',     needs: 11, crises: 2, resources: 1, lat: 19.6967, lng: 73.5624, intensity: 0.55 },
  { id: 'c4', region: 'Nagpur',    district: 'Kamptee',      needs: 8,  crises: 0, resources: 3, lat: 21.1458, lng: 79.0882, intensity: 0.35 },
  { id: 'c5', region: 'Aurangabad',district: 'Cidco',        needs: 6,  crises: 1, resources: 2, lat: 19.8762, lng: 75.3433, intensity: 0.28 },
];

const UNRESOLVED = [
  { id: 'u1', type: 'PM-JAY Application', patient: 'Riya S.', region: 'Mumbai', days: 4, urgency: 0.92 },
  { id: 'u2', type: 'Specialist Connect', patient: 'Amir K.', region: 'Nashik', days: 7, urgency: 0.95 },
  { id: 'u3', type: 'UDID Certificate',   patient: 'Meera P.', region: 'Pune',  days: 2, urgency: 0.74 },
];

// ── View filter logic ─────────────────────────────────────────────────────────
function getViewConfig(role: SubRole) {
  if (role === 'asha') return {
    accent: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200',
    label: 'Hyperlocal Field View',
    desc: 'Your assigned district — daily suggestions for where to go and what to do.',
    showClusters: CLUSTERS.slice(0, 2),
  };
  if (role === 'government') return {
    accent: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200',
    label: 'Regional Allocation View',
    desc: 'Full regional heatmap — identify underserved areas and reallocate resources.',
    showClusters: CLUSTERS,
  };
  return {
    accent: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
    label: 'System-Level Admin View',
    desc: 'Full system heatmap with all clusters, crisis flags, and resource gaps.',
    showClusters: CLUSTERS,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CoordinatorPage() {
  const { profile } = useAuth();
  const storedRole = ((profile as any)?.subRole ?? 'asha') as SubRole;
  const [subRole, setSubRole] = useState<SubRole>(storedRole);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cfg = getViewConfig(subRole);
  const name = profile?.firstName ?? profile?.displayName?.split(' ')[0] ?? 'Coordinator';

  const stats = [
    { label: 'Open Tasks',      val: CLUSTERS.reduce((s, c) => s + c.needs, 0).toString(),   icon: ClipboardList, color: 'text-rose-600 bg-rose-50' },
    { label: 'Active Crises',   val: CLUSTERS.reduce((s, c) => s + c.crises, 0).toString(),  icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Volunteers Live', val: '14',  icon: Users,       color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Resolved Today',  val: '7',   icon: TrendingUp,  color: 'text-sky-600 bg-sky-50' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-3 ${cfg.bg} ${cfg.accent} ${cfg.border}`}>
            {SUBROLE_LABELS[subRole]}
          </div>
          <h1 className="text-3xl font-black text-dark-slate">Welcome, {name}</h1>
          <p className="text-light-slate font-medium mt-1">{cfg.desc}</p>
        </div>

        {/* Sub-role switcher */}
        <div className="flex p-1 bg-surface-100 rounded-2xl gap-1 shrink-0">
          {(['asha', 'government', 'admin'] as SubRole[]).map(r => (
            <button key={r} onClick={() => setSubRole(r)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${subRole === r ? 'bg-white text-cyan-700 shadow-md' : 'text-light-slate hover:text-dark-slate'}`}>
              {r === 'asha' ? 'ASHA' : r === 'government' ? 'Govt' : 'Admin'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-white rounded-2xl border border-surface-200 p-5 flex flex-col items-center gap-2">
              <div className={`p-2 rounded-xl ${s.color}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-black text-dark-slate">{s.val}</p>
              <p className="text-xs text-light-slate font-bold text-center">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Map + Clusters grid */}
      <div className="grid md:grid-cols-5 gap-6">

        {/* Leaflet Map */}
        <div className="md:col-span-3 bg-white rounded-3xl border border-surface-200 overflow-hidden" style={{ height: 420 }}>
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-dark-slate">Disease Density & Need Heatmap</h2>
            <span className="text-xs text-light-slate font-medium">Maharashtra, India</span>
          </div>
          <div className="h-[360px] w-full">
            {mounted && <Map clusters={cfg.showClusters} subRole={subRole} />}
          </div>
        </div>

        {/* Cluster list */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-surface-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-dark-slate mb-4">Priority Clusters</h2>
          {cfg.showClusters.sort((a, b) => b.intensity - a.intensity).map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
              className="p-4 rounded-2xl border border-surface-200 hover:border-cyan-300 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-dark-slate text-sm">{c.district}</p>
                  <p className="text-xs text-light-slate">{c.region}</p>
                </div>
                {c.crises > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> {c.crises} crisis
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-light-slate font-medium">Unmet needs</span>
                  <span className="font-bold text-dark-slate">{c.needs}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-600"
                    initial={{ width: 0 }} animate={{ width: `${c.intensity * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                  />
                </div>
              </div>
              <button className="mt-3 w-full py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors group-hover:shadow-md">
                Route Task → Volunteer
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Unresolved tasks */}
      <div className="bg-white rounded-3xl border border-surface-200 p-6">
        <h2 className="text-sm font-bold text-dark-slate mb-4">Unresolved Tasks — Escalation Required</h2>
        <div className="space-y-3">
          {UNRESOLVED.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-rose-100 bg-rose-50/50 hover:border-rose-300 transition-all">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-dark-slate text-sm">{t.type}</p>
                <p className="text-xs text-light-slate">{t.patient} · {t.region} · {t.days}d unresolved</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors">Assign</button>
                <button className="px-3 py-1.5 rounded-xl border-2 border-surface-200 hover:border-cyan-300 text-dark-slate text-xs font-bold transition-colors">View</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
