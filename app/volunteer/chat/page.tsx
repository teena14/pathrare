'use client';

import Link from 'next/link';
import { ArrowLeft, BellRing, CircleDot, Clock3, LockKeyhole, MessageSquareText, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defaultPresenceParticipant } from '@/services/tasks/task-chat';
import { useTaskPresence } from '@/hooks/use-task-presence';
import { statusTone, useVolunteerDashboard } from '@/features/volunteer/context/volunteer-dashboard-context';
import { VolunteerSharedHeader } from '@/features/volunteer/components/shared-header';

function presenceTone(isOnline: boolean) {
  return isOnline ? 'bg-emerald-500' : 'bg-slate-300';
}

export default function VolunteerChatPage() {
  const [draftMessage, setDraftMessage] = useState('');
  const typingTimeoutRef = useRef<number | null>(null);
  const {
    tasks,
    selectedTask,
    selectedTaskId,
    setSelectedTaskId,
    chatMessages,
    sendMessage,
  } = useVolunteerDashboard();
  const { peerPresence, selfPresence, setTyping } = useTaskPresence({
    taskId: selectedTask?.id ?? '',
    role: 'volunteer',
    enabled: Boolean(selectedTask),
  });

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      setTyping(false);
    };
  }, [setTyping]);

  const volunteerPresence = selfPresence ?? defaultPresenceParticipant('volunteer');
  const patientPresence = peerPresence ?? defaultPresenceParticipant('user');

  const handleDraftChange = (value: string) => {
    setDraftMessage(value);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    const hasText = Boolean(value.trim());
    setTyping(hasText);

    if (hasText) {
      typingTimeoutRef.current = window.setTimeout(() => {
        setTyping(false);
      }, 1500);
    }
  };

  const handleSendMessage = async () => {
    try {
      await sendMessage(draftMessage);
      setTyping(false);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      setDraftMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <VolunteerSharedHeader />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.2fr]">
        <section className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-5 text-dark-slate">Case Threads</h2>
          <div className="space-y-3">
            {tasks.filter((task) => task.status === 'Active' || task.status === 'Completed').map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full rounded-[1.6rem] border p-4 text-left transition-all ${
                  selectedTaskId === task.id
                    ? 'border-brand-blue-100 bg-brand-blue-50'
                    : 'border-brand-slate-100 bg-white hover:border-brand-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-dark-slate">{task.title}</p>
                    <p className="mt-1 text-xs font-medium text-light-slate">{task.assistanceType}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusTone(task.status)}`}>{task.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-light-slate">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Locked case thread
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="theme-card flex min-h-[560px] flex-col rounded-[2rem] p-6">
          {selectedTask ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-slate-100 pb-5">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Link
                      href="/volunteer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-light-slate transition-colors hover:text-primary-blue"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to assigned work
                    </Link>
                  </div>
                  <h2 className="theme-title-24 text-dark-slate">{selectedTask.title}</h2>
                  <p className="theme-body mt-1 text-light-slate">{selectedTask.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-dark-slate">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-slate-50 px-3 py-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${presenceTone(volunteerPresence.isOnline)}`} />
                      You: {volunteerPresence.statusText}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-slate-50 px-3 py-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${presenceTone(patientPresence.isOnline)}`} />
                      {patientPresence.label}: {patientPresence.statusText}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-light-slate">
                  <Clock3 className="h-3.5 w-3.5" />
                  Async-friendly case chat
                </div>
              </div>

              <div className="flex-1 space-y-4 py-5">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[80%] rounded-[1.5rem] px-4 py-3 text-sm font-medium ${
                      message.author === 'volunteer'
                        ? 'ml-auto bg-primary-blue text-white'
                        : message.author === 'system'
                          ? 'theme-soft text-dark-slate'
                          : 'border border-brand-slate-100 bg-white text-dark-slate'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] opacity-75">
                      {message.author === 'volunteer' && <Send className="h-3 w-3" />}
                      {message.author === 'system' && <BellRing className="h-3 w-3" />}
                      {message.author === 'user' && <CircleDot className="h-3 w-3" />}
                      {message.author}
                    </div>
                    <p>{message.body}</p>
                    <p className="mt-2 text-[11px] font-bold opacity-75">{message.timestamp}</p>
                  </div>
                ))}

                {patientPresence.isTyping && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-slate-50 px-3 py-2 text-xs font-bold text-light-slate">
                    <span className="h-2 w-2 rounded-full bg-primary-blue" />
                    {patientPresence.label} is typing...
                  </div>
                )}
              </div>

              <div className="border-t border-brand-slate-100 pt-4">
                <div className="theme-soft mb-4 rounded-[1.8rem] p-4 text-sm font-medium text-light-slate">
                  Suggested first step: acknowledge the user, clarify the immediate goal, and keep the thread active even if they reply later.
                </div>
                <div className="flex gap-3">
                  <input
                    value={draftMessage}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder="Send the next case-specific update..."
                    className="flex-1 rounded-full border border-brand-slate-100 bg-white px-4 py-3 text-sm font-medium text-dark-slate focus:border-brand-blue-100 focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSendMessage()}
                    className="theme-primary rounded-full px-5 py-3 text-sm font-bold"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <MessageSquareText className="mx-auto mb-3 h-10 w-10 text-primary-blue" />
                <p className="text-sm font-bold text-dark-slate">No active chat yet</p>
                <p className="theme-body mt-1 text-light-slate">Start a task first, then its case chat will appear here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
