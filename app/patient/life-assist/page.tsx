'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, MessageSquareText } from 'lucide-react';
import { canOpenTaskChat, dedupeSupportTasks, humanizeTaskStatus, mapSupportTask, SupportTask } from '@/lib/task-chat';

const CATEGORIES = [
  { id: 'financial', label: 'Financial & Legal Aid', emoji: '💰', desc: 'Schemes, disability certificates, legal rights' },
  { id: 'education', label: 'Adaptive Education', emoji: '📚', desc: 'IEPs, home schooling, special educator access' },
  { id: 'medical', label: 'Medical & Care', emoji: '🏥', desc: 'Specialist connects, second opinions, medicine aid' },
  { id: 'assistive', label: 'Assistive Technology', emoji: '🦾', desc: 'Devices, mobility aids, adaptive tools' },
] as const;

export default function LifeAssistLandingPage() {
  const [supportTasks, setSupportTasks] = useState<SupportTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (showLoading: boolean) => {
      try {
        if (showLoading) setLoading(true);
        const { auth: firebaseAuth } = await import('@/lib/firebase');
        const userId = firebaseAuth.currentUser?.uid;
        if (!userId) {
          if (active) {
            setSupportTasks([]);
            setLoading(false);
          }
          return;
        }

        const response = await fetch(`/api/tasks?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Failed to load support requests.');
        if (!active) return;

        const tasks = Array.isArray(data.tasks)
          ? data.tasks.map((task: Record<string, unknown>) => mapSupportTask(task))
          : [];

        setSupportTasks(dedupeSupportTasks(tasks));
      } catch (error) {
        if (active) {
          console.error(error);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load(true);
    const interval = window.setInterval(() => void load(false), 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-dark-slate">Life Assist</h1>
        <p className="text-light-slate font-medium mt-1">
          Choose the support area you want to explore. Each section opens a dedicated feed of backend-curated resources matched to your profile.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
          >
            <Link
              href={`/patient/life-assist/${item.id}`}
              className="block rounded-3xl border-2 border-surface-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary-blue/40 hover:shadow-xl"
            >
              <div className="text-4xl mb-4">{item.emoji}</div>
              <h2 className="text-lg font-bold text-dark-slate mb-1">{item.label}</h2>
              <p className="text-xs font-medium text-light-slate">{item.desc}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-dark-slate">Help Requested</h2>
          <p className="text-sm font-medium text-light-slate mt-1">
            Every support request you have created across all Life Assist categories appears here.
          </p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-surface-200 bg-white p-6 text-sm font-medium text-light-slate">
            Loading your requested help...
          </div>
        )}

        {!loading && supportTasks.length === 0 && (
          <div className="rounded-3xl border border-surface-200 bg-white p-6 text-sm font-medium text-light-slate">
            No help requests yet. Open any category above and request volunteer help when you need it.
          </div>
        )}

        {!loading && supportTasks.length > 0 && (
          <div className="space-y-3">
            {supportTasks.map((task) => (
              (() => {
                const chatReady = Boolean(task.assignedVolunteerId) && canOpenTaskChat(task.status);

                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-surface-200 bg-white p-4 transition-all hover:border-primary-blue/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-dark-slate">{task.resourceName ?? task.title}</p>
                        <p className="mt-1 text-xs font-medium text-light-slate">{task.summary}</p>
                        {task.category && (
                          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-blue">
                            {CATEGORIES.find((item) => item.id === task.category)?.label ?? task.category}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-bold uppercase text-light-slate">
                          {humanizeTaskStatus(task.status)}
                        </span>
                      </div>
                    </div>
                    {task.assignedVolunteerName && (
                      <p className="mt-3 text-xs font-bold text-primary-blue">Volunteer: {task.assignedVolunteerName}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={task.category ? `/patient/life-assist/${task.category}` : '/patient/life-assist'}
                        className="inline-flex items-center gap-2 text-xs font-bold text-light-slate transition-colors hover:text-primary-blue"
                      >
                        View request details
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/patient/life-assist/chat?task=${encodeURIComponent(task.id)}`}
                        aria-disabled={!chatReady}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                          chatReady
                            ? 'bg-primary-blue text-white hover:bg-blue-700'
                            : 'cursor-not-allowed bg-surface-100 text-light-slate'
                        }`}
                        onClick={(event) => {
                          if (!chatReady) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <MessageSquareText className="h-4 w-4" />
                        {chatReady ? 'Open chat' : 'Waiting for volunteer'}
                      </Link>
                    </div>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
