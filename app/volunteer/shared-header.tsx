'use client';

import { CheckCircle2, MessageSquareText, ShieldCheck, UserRoundSearch, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { AvailabilityStatus, useVolunteerDashboard } from './volunteer-dashboard-context';

export function VolunteerSharedHeader() {
  const {
    availability,
    associatedNgoIds,
    assignedTasks,
    canAcceptOpenTasks,
    completedTasks,
    openTasks,
    selectedTask,
    setAvailability,
    name,
  } = useVolunteerDashboard();
  const { profile } = useAuth();
  const profileRecord = (profile as unknown as Record<string, unknown> | null) ?? null;
  const ngoName = typeof profileRecord?.orgName === 'string'
    ? String(profileRecord.orgName)
    : '';

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-blue-100 bg-brand-blue-50 px-3 py-1 text-xs font-bold text-primary-blue">
            <ShieldCheck className="h-3.5 w-3.5" />
            Volunteer Dashboard
          </div>
          <h1 className="theme-heading-40 text-dark-slate">Welcome, {name}</h1>
          <p className="theme-body mt-2 max-w-2xl text-light-slate">A task-first workspace built for clear action, one case at a time.</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-light-slate">
            {canAcceptOpenTasks
              ? associatedNgoIds.length > 0
                ? `Associations: ${associatedNgoIds.length} NGO${associatedNgoIds.length === 1 ? '' : 's'} linked`
                : 'Association: Independent volunteer'
              : associatedNgoIds.length > 0
                ? `Associations: ${associatedNgoIds.length} NGO${associatedNgoIds.length === 1 ? '' : 's'} linked${ngoName ? `, including ${ngoName}` : ''}`
                : 'Association: Independent volunteer'}
          </p>
        </div>

        <div className="theme-card min-w-80 rounded-3xl p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-light-slate">Availability status</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['Available', 'Busy', 'Offline'] as AvailabilityStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => void setAvailability(status)}
                className={`rounded-2xl px-3 py-2 text-sm font-bold transition-all ${
                  availability === status
                    ? 'theme-primary'
                    : 'theme-pill'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-light-slate">
            {availability === 'Available' && 'You can receive or accept one task right now.'}
            {availability === 'Busy' && 'You are currently locked to an active case and should not accept another one.'}
            {availability === 'Offline' && 'You will stay out of assignment and open-task matching until you return.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Assigned now', value: String(assignedTasks.length), icon: Zap, tone: 'text-primary-blue bg-brand-blue-50' },
          { label: 'Open tasks', value: canAcceptOpenTasks ? String(openTasks.length) : 'Locked', icon: UserRoundSearch, tone: 'text-light-slate bg-brand-slate-50' },
          { label: 'Completed', value: String(completedTasks.length), icon: CheckCircle2, tone: 'text-primary-blue bg-brand-blue-50' },
          { label: 'Case chat', value: selectedTask ? 'Live' : 'Idle', icon: MessageSquareText, tone: 'text-dark-slate bg-brand-slate-100' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="theme-card rounded-3xl p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-2xl font-black text-dark-slate">{item.value}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-light-slate">{item.label}</p>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
