'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle, Clock, Star, Zap } from 'lucide-react';

const MATCH_SCORE = (skill: number, avail: number, prox: number, rel: number, exp: number) =>
  +(skill * 0.35 + avail * 0.25 + prox * 0.15 + rel * 0.15 + exp * 0.10).toFixed(2);

const TASKS = [
  { id: 'vt1', title: 'PM-JAY Application Assistance', patient: 'Riya S., Pune', urgency: 'Urgent', skills: ['Form Filling', 'Legal Literacy'], time: '~3 hrs', score: MATCH_SCORE(0.9, 0.8, 0.7, 0.85, 0.6) },
  { id: 'vt2', title: 'UDID Certificate Filing',       patient: 'Arjun M., Nashik', urgency: 'High',   skills: ['Form Filling'], time: '~2 hrs', score: MATCH_SCORE(0.8, 0.9, 0.5, 0.9, 0.7) },
  { id: 'vt3', title: 'Specialist Appointment Escort', patient: 'Priya K., Mumbai', urgency: 'Urgent', skills: ['Medical Escort'], time: '~4 hrs', score: MATCH_SCORE(0.6, 0.7, 0.9, 0.8, 0.8) },
];

const URGENCY_STYLE: Record<string, string> = {
  Urgent: 'bg-rose-100 text-rose-700 border-rose-300',
  High:   'bg-amber-100 text-amber-700 border-amber-300',
  Medium: 'bg-sky-100 text-sky-700 border-sky-300',
};

export default function VolunteerPage() {
  const { profile } = useAuth();
  const name = profile?.firstName ?? profile?.displayName?.split(' ')[0] ?? 'Volunteer';
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const stats = [
    { label: 'Completed', val: '14', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Active',    val: '1',  icon: Zap,          color: 'text-amber-600 bg-amber-50'   },
    { label: 'Avg Rating',val: '4.8',icon: Star,         color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Hrs Given', val: '38', icon: Clock,        color: 'text-sky-600 bg-sky-50'        },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 mb-3">Volunteer Dashboard</div>
        <h1 className="text-3xl font-black text-dark-slate">Welcome, {name} 👋</h1>
        <p className="text-light-slate font-medium mt-1">Your task feed — sorted by match score.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-white rounded-2xl border border-surface-200 p-4 flex flex-col items-center gap-2">
              <div className={`p-2 rounded-xl ${s.color}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-black text-dark-slate">{s.val}</p>
              <p className="text-xs text-light-slate font-bold">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Task feed */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-dark-slate">Suggested Tasks</h2>
        <p className="text-xs text-light-slate font-medium -mt-2">
          Match Score = (Skill × 0.35) + (Availability × 0.25) + (Proximity × 0.15) + (Reliability × 0.15) + (Experience × 0.10)
        </p>

        {TASKS.sort((a, b) => b.score - a.score).map((task, i) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`bg-white rounded-3xl border-2 p-5 transition-all duration-300 ${accepted.has(task.id) ? 'border-emerald-400 bg-emerald-50/50' : 'border-surface-200 hover:border-amber-300 hover:shadow-md'}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-dark-slate">{task.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${URGENCY_STYLE[task.urgency]}`}>{task.urgency}</span>
                </div>
                <p className="text-xs text-light-slate font-medium">{task.patient}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black text-dark-slate">{Math.round(task.score * 100)}<span className="text-sm text-light-slate font-bold">%</span></p>
                <p className="text-xs text-light-slate font-bold">match</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {task.skills.map(s => <span key={s} className="px-2.5 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-lg">{s}</span>)}
              <span className="flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-lg"><Clock className="w-3 h-3" />{task.time}</span>
            </div>

            {accepted.has(task.id) ? (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                <CheckCircle className="w-4 h-4" /> Task accepted — patient will be notified
              </div>
            ) : (
              <button onClick={() => setAccepted(prev => new Set([...prev, task.id]))}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
                Accept Task
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
