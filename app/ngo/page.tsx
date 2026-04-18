'use client';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';

const MOCK_TASKS = [
  { id: 't1', type: 'PM-JAY Application', patient: 'Riya S.', district: 'Pune', urgency: 0.92, skills: ['Form Filling', 'Legal Literacy'], status: 'Pending' },
  { id: 't2', type: 'UDID Certificate',   patient: 'Arjun M.', district: 'Nashik', urgency: 0.78, skills: ['Form Filling'], status: 'Pending' },
  { id: 't3', type: 'Emergency Medical Fund', patient: 'Priya K.', district: 'Mumbai', urgency: 0.88, skills: ['Counselling'], status: 'In Progress' },
];

const DEMAND = [
  { region: 'Mumbai',  count: 24, fill: 'bg-rose-500' },
  { region: 'Pune',    count: 18, fill: 'bg-amber-500' },
  { region: 'Nashik',  count: 11, fill: 'bg-sky-500' },
  { region: 'Nagpur',  count: 8,  fill: 'bg-emerald-500' },
  { region: 'Solapur', count: 5,  fill: 'bg-violet-500' },
];

export default function NGOPage() {
  const { profile } = useAuth();
  const name = (profile as any)?.orgName ?? profile?.displayName ?? 'Organisation';

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-3">NGO Dashboard</div>
        <h1 className="text-3xl font-black text-dark-slate">{name}</h1>
        <p className="text-light-slate font-medium mt-1">Active task clusters · Demand overview · Case briefs</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Open Tasks', val: '3' }, { label: 'Assigned', val: '1' }, { label: 'Resolved (30d)', val: '12' }].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white rounded-2xl border border-surface-200 p-5 text-center">
            <p className="text-3xl font-black text-dark-slate">{s.val}</p>
            <p className="text-xs text-light-slate font-bold mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Task feed */}
        <div className="bg-white rounded-3xl border border-surface-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-dark-slate">Pending Task Batch</h2>
          {MOCK_TASKS.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="p-4 rounded-2xl border border-surface-200 hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-bold text-dark-slate text-sm">{task.type}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${task.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{task.status}</span>
              </div>
              <p className="text-xs text-light-slate font-medium mb-2">{task.patient} · {task.district}</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${task.urgency * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-rose-600">{Math.round(task.urgency * 100)}% urgent</span>
              </div>
              <div className="flex gap-2">
                {task.skills.map(s => <span key={s} className="px-2 py-0.5 bg-surface-100 text-light-slate text-xs font-bold rounded-lg">{s}</span>)}
              </div>
              <button className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">Accept Task</button>
            </motion.div>
          ))}
        </div>

        {/* Demand by region */}
        <div className="bg-white rounded-3xl border border-surface-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-dark-slate">Demand by Region</h2>
          {DEMAND.map((d, i) => (
            <div key={d.region} className="space-y-1">
              <div className="flex justify-between text-xs font-bold"><span className="text-dark-slate">{d.region}</span><span className="text-light-slate">{d.count} tasks</span></div>
              <motion.div className="h-2 bg-surface-100 rounded-full overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <motion.div className={`h-full rounded-full ${d.fill}`} initial={{ width: 0 }} animate={{ width: `${(d.count / 24) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} />
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
