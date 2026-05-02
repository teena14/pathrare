'use client';

import { UserRoundSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { urgencyTone, useVolunteerDashboard } from '@/features/volunteer/context/volunteer-dashboard-context';
import { VolunteerSharedHeader } from '@/features/volunteer/components/shared-header';

export default function VolunteerOpenTasksPage() {
  const {
    availability,
    canAcceptOpenTasks,
    hasActiveWork,
    loading,
    openTasks,
    acceptTask,
  } = useVolunteerDashboard();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <VolunteerSharedHeader />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
        <section className="theme-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="theme-title-24 text-dark-slate">Open Tasks</h2>
              <p className="theme-body mt-1 text-light-slate">Only relevant tasks matched to your skills should appear here.</p>
            </div>
            <div className="theme-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold">
              <UserRoundSearch className="h-3.5 w-3.5" />
              {canAcceptOpenTasks ? 'Eligible to accept now' : 'Locked until available'}
            </div>
          </div>

          {!canAcceptOpenTasks && (
            <div className="theme-soft rounded-[1.8rem] p-6 text-sm font-medium text-light-slate">
              You can belong to multiple NGOs and still receive the global pool, but you can only accept one active case at a time.
            </div>
          )}

          <div className="space-y-4">
            {loading && (
              <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
                Loading open support requests...
              </div>
            )}
            {openTasks.map((task) => (
              <div key={task.id} className="theme-soft rounded-[1.8rem] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-dark-slate">{task.title}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${urgencyTone(task.urgency)}`}>{task.urgency}</span>
                    </div>
                    <p className="theme-body mt-2 text-light-slate">{task.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Estimated time</p>
                    <p className="mt-1 text-sm font-bold text-dark-slate">{task.estimatedTime}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {task.skills.map((skill) => (
                    <span key={skill} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-light-slate">
                    {hasActiveWork ? 'Finish your current assigned task before accepting another one.' : 'Accepting will lock this case to you immediately.'}
                  </div>
                  <button
                    onClick={async () => {
                      await acceptTask(task.id);
                      router.push('/volunteer');
                    }}
                    disabled={availability !== 'Available' || hasActiveWork}
                    className="theme-primary rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate disabled:shadow-none"
                  >
                    Accept and lock case
                  </button>
                </div>
              </div>
            ))}
            {!loading && openTasks.length === 0 && (
              <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
                No open patient requests match your current skills right now.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="theme-card rounded-[2rem] p-6">
            <h2 className="theme-title-24 mb-4 text-dark-slate">What Happens on Accept</h2>
            <div className="space-y-3 text-sm font-medium text-dark-slate">
              <div className="theme-soft rounded-2xl p-4">The case is assigned exclusively to you and removed from everyone else.</div>
              <div className="theme-soft rounded-2xl p-4">The user is notified right away that they have been matched with a support navigator.</div>
              <div className="theme-soft rounded-2xl p-4">The task first appears in your assigned work. Starting it unlocks the case chat thread.</div>
            </div>
          </div>

          <div className="theme-card rounded-[2rem] p-6">
            <h2 className="theme-title-24 mb-4 text-dark-slate">Availability Reminder</h2>
            <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
              Your current availability is <span className="font-bold text-dark-slate">{availability}</span>. Only volunteers marked available should receive or accept tasks.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
