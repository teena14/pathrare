'use client';

import { LockKeyhole, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VolunteerNgoAssociationPanel } from '@/features/volunteer/components/ngo-association-panel';
import { statusTone, urgencyTone, useVolunteerDashboard } from '@/features/volunteer/context/volunteer-dashboard-context';
import { VolunteerSharedHeader } from '@/features/volunteer/components/shared-header';

export default function VolunteerPage() {
  const {
    acceptTask,
    assignedTasks,
    completeTask,
    completedTasks,
    deleteTask,
    loading,
    selectedTask,
    setSelectedTaskId,
    startTask,
  } = useVolunteerDashboard();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <VolunteerSharedHeader />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
        <section className="theme-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="theme-title-24 text-dark-slate">Assigned Work</h2>
              <p className="theme-body mt-1 text-light-slate">These are the cases you are responsible for right now.</p>
            </div>
            <div className="theme-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold">
              <LockKeyhole className="h-3.5 w-3.5" />
              One active case at a time
            </div>
          </div>

          <div className="space-y-4">
            {loading && (
              <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
                Loading assigned cases...
              </div>
            )}
            {assignedTasks.map((task) => (
              <div key={task.id} className="theme-soft rounded-[1.8rem] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-dark-slate">{task.title}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${urgencyTone(task.urgency)}`}>{task.urgency}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(task.status)}`}>{task.status}</span>
                    </div>
                    <p className="theme-body mt-2 text-light-slate">{task.summary}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Support type</p>
                      <p className="mt-1 text-sm font-bold text-primary-blue">{task.assistanceType}</p>
                    </div>
                    <button
                      onClick={() => void deleteTask(task.id)}
                      disabled={task.status !== 'Completed'}
                      title={task.status === 'Completed' ? 'Delete from dashboard' : 'Complete this task before deleting it'}
                      className="rounded-full border border-surface-200 p-2 text-light-slate transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {task.skills.map((skill) => (
                    <span key={skill} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                      {skill}
                    </span>
                  ))}
                  <span className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">{task.estimatedTime}</span>
                  <span className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">{task.source}</span>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-bold text-light-slate">
                    {task.status === 'Pending'
                      ? 'Your NGO offered this case to you. Accept it before it becomes locked.'
                      : task.caseLocked
                        ? 'Case is locked to you and removed from all other volunteers.'
                        : 'Awaiting confirmation.'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.status === 'Pending' && (
                      <button onClick={() => void acceptTask(task.id)} className="theme-primary rounded-full px-4 py-2 text-sm font-bold">
                        Accept case
                      </button>
                    )}
                    {task.status === 'Assigned' && (
                      <button
                        onClick={() => {
                          startTask(task.id);
                          router.push('/volunteer/chat');
                        }}
                        className="theme-primary rounded-full px-4 py-2 text-sm font-bold"
                      >
                        Start task
                      </button>
                    )}
                    {task.status === 'Active' && (
                      <button
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          router.push('/volunteer/chat');
                        }}
                        className="theme-pill rounded-full px-4 py-2 text-sm font-bold"
                      >
                        Open chat
                      </button>
                    )}
                    <button onClick={() => completeTask(task.id)} className="theme-pill rounded-full px-4 py-2 text-sm font-bold">
                      Mark complete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && assignedTasks.length === 0 && (
              <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
                No volunteer cases are assigned to you yet.
              </div>
            )}

            {!loading && completedTasks.length > 0 && (
              <div className="space-y-4 border-t border-brand-slate-100 pt-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-light-slate">Completed Tasks</h3>
                  <p className="mt-1 text-sm font-medium text-light-slate">Delete completed items from your dashboard whenever you no longer need them here.</p>
                </div>
                {completedTasks.map((task) => (
                  <div key={task.id} className="theme-soft rounded-[1.8rem] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-dark-slate">{task.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(task.status)}`}>{task.status}</span>
                        </div>
                        <p className="theme-body mt-2 text-light-slate">{task.summary}</p>
                      </div>
                      <button
                        onClick={() => void deleteTask(task.id)}
                        title="Delete from dashboard"
                        className="rounded-full border border-surface-200 p-2 text-light-slate transition-colors hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <VolunteerNgoAssociationPanel />

          <div className="theme-card rounded-[2rem] p-6">
            <h2 className="theme-title-24 mb-4 text-dark-slate">Execution Rules</h2>
          <div className="space-y-3 text-sm font-medium text-dark-slate">
            <div className="theme-soft rounded-2xl p-4">Tasks are case-specific and should move through chat, not general messaging.</div>
            <div className="theme-soft rounded-2xl p-4">Volunteers may see multiple eligible tasks across NGOs and the global pool, but only one can be accepted at a time.</div>
            <div className="theme-soft rounded-2xl p-4">NGO-linked volunteers can receive NGO-matched work and the global pool, but accepting one task makes them busy until completion.</div>
          </div>
        </div>

          <div className="theme-card rounded-[2rem] p-6">
            <h2 className="theme-title-24 mb-4 text-dark-slate">Immediate Next Step</h2>
            {selectedTask ? (
              <div className="rounded-2xl border border-brand-blue-100 bg-brand-blue-50 p-4">
                <p className="text-sm font-black text-dark-slate">{selectedTask.title}</p>
                <p className="theme-body mt-2 text-light-slate">
                  {selectedTask.status === 'Pending'
                    ? 'Review the NGO-offered case and accept it to lock the request to you.'
                    : selectedTask.status === 'Assigned'
                    ? 'Start the task to unlock case chat and begin helping the user.'
                    : selectedTask.userNotice ?? 'Open the case chat and continue the task.'}
                </p>
              </div>
            ) : (
              <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">No active task selected yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
