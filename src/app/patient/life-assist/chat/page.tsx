'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BellRing,
  CircleDot,
  MessageSquareText,
  Send,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  canOpenTaskChat,
  ChatMessage,
  dedupeSupportTasks,
  defaultPresenceParticipant,
  humanizeTaskStatus,
  mapChatMessage,
  mapSupportTask,
  SupportTask,
} from '@/services/tasks/task-chat';
import { useTaskPresence } from '@/hooks/use-task-presence';

function presenceTone(isOnline: boolean) {
  return isOnline ? 'bg-emerald-500' : 'bg-slate-300';
}

export default function PatientLifeAssistChatPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTaskId = searchParams.get('task') ?? '';
  const profileUid = profile?.uid ?? '';

  const [supportTasks, setSupportTasks] = useState<SupportTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const typingTimeoutRef = useRef<number | null>(null);

  const chatReadyTasks = useMemo(
    () => supportTasks.filter((task) => Boolean(task.assignedVolunteerId) && canOpenTaskChat(task.status)),
    [supportTasks]
  );

  const selectedTask = useMemo(
    () => chatReadyTasks.find((task) => task.id === requestedTaskId) ?? chatReadyTasks[0] ?? null,
    [chatReadyTasks, requestedTaskId]
  );
  const selectedTaskKey = selectedTask?.id ?? '';

  const loadTasks = useCallback(async (showLoading: boolean) => {
    if (!profileUid) {
      setSupportTasks([]);
      setTasksLoading(false);
      return;
    }

    if (showLoading) {
      setTasksLoading(true);
    }

    const response = await fetch(`/api/tasks?userId=${encodeURIComponent(profileUid)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load support requests.');
    }

    const tasks = Array.isArray(data.tasks)
      ? data.tasks.map((task: Record<string, unknown>) => mapSupportTask(task))
      : [];

    setSupportTasks(dedupeSupportTasks(tasks));
    setTasksLoading(false);
  }, [profileUid]);

  const loadMessages = useCallback(async () => {
    if (!selectedTaskKey) {
      setChatLoading(false);
      return;
    }

    setChatLoading(true);

    const response = await fetch(`/api/tasks/${encodeURIComponent(selectedTaskKey)}/messages`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load chat.');
    }

    setChatMessages(
      Array.isArray(data.messages)
        ? data.messages.map((message: Record<string, unknown>) => mapChatMessage(message))
        : []
    );
    setChatLoading(false);
  }, [selectedTaskKey]);

  const { peerPresence, selfPresence, setTyping } = useTaskPresence({
    taskId: selectedTaskKey,
    role: 'user',
    enabled: Boolean(selectedTask),
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadTasks(true);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setTasksLoading(false);
        }
      }
    };

    void run();
    const interval = window.setInterval(() => {
      void loadTasks(false).catch((error) => console.error(error));
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    if (!requestedTaskId || requestedTaskId !== selectedTask.id) {
      router.replace(`/patient/life-assist/chat?task=${encodeURIComponent(selectedTask.id)}`, { scroll: false });
    }
  }, [requestedTaskId, router, selectedTask]);

  useEffect(() => {
    if (!selectedTaskKey) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await loadMessages();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setChatLoading(false);
        }
      }
    };

    void run();
    const interval = window.setInterval(() => {
      void run();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadMessages, selectedTaskKey]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      setTyping(false);
    };
  }, [setTyping]);

  const handleSelectTask = (taskId: string) => {
    router.push(`/patient/life-assist/chat?task=${encodeURIComponent(taskId)}`, { scroll: false });
  };

  const handleDraftChange = (value: string) => {
    setChatDraft(value);

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
      if (!selectedTask || !chatDraft.trim() || !profileUid) return;

      const senderName =
        ((profile as Record<string, unknown> | null)?.firstName as string | undefined) ??
        profile?.displayName ??
        'Patient';

      const response = await fetch(`/api/tasks/${encodeURIComponent(selectedTask.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'user',
          senderId: profileUid,
          senderName,
          body: chatDraft.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send message.');
      }

      setChatDraft('');
      setTyping(false);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      await loadMessages();
    } catch (error) {
      console.error(error);
    }
  };

  const volunteerPresence = peerPresence ?? defaultPresenceParticipant('volunteer');
  const patientPresence = selfPresence ?? defaultPresenceParticipant('user');

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <div className="space-y-3">
        <Link
          href="/patient/life-assist"
          className="inline-flex items-center gap-2 text-xs font-bold text-light-slate transition-colors hover:text-primary-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to support requests
        </Link>
        <div>
          <h1 className="text-3xl font-black text-dark-slate">Support Chats</h1>
          <p className="mt-1 text-sm font-medium text-light-slate">
            Each accepted scheme request gets its own thread, so you can switch between volunteers without mixing conversations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.24fr]">
        <section className="rounded-[2rem] border border-surface-200 bg-white p-6">
          <h2 className="text-xl font-black text-dark-slate">Chat Threads</h2>
          <p className="mt-1 text-sm font-medium text-light-slate">
            Chats appear here after a volunteer starts helping on that request.
          </p>

          <div className="mt-5 space-y-3">
            {tasksLoading && (
              <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                Loading your chat threads...
              </div>
            )}

            {!tasksLoading && chatReadyTasks.length === 0 && (
              <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                No live chats yet. Your support requests will unlock an Open chat button once a volunteer connects.
              </div>
            )}

            {chatReadyTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSelectTask(task.id)}
                className={`w-full rounded-[1.6rem] border p-4 text-left transition-all ${
                  selectedTask?.id === task.id
                    ? 'border-brand-blue-100 bg-brand-blue-50'
                    : 'border-surface-200 hover:border-primary-blue/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-dark-slate">{task.resourceName ?? task.title}</p>
                    <p className="mt-1 text-xs font-medium text-light-slate">
                      {task.assignedVolunteerName ?? 'Volunteer'}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-bold uppercase text-light-slate">
                    {humanizeTaskStatus(task.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs font-medium text-light-slate">{task.summary}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-h-[620px] flex-col rounded-[2rem] border border-surface-200 bg-white p-6">
          {selectedTask ? (
            <>
              <div className="border-b border-surface-200 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-dark-slate">{selectedTask.resourceName ?? selectedTask.title}</h2>
                    <p className="mt-1 text-sm font-medium text-light-slate">{selectedTask.summary}</p>
                  </div>
                  <span className="rounded-full bg-brand-blue-50 px-3 py-1 text-xs font-bold text-primary-blue">
                    {humanizeTaskStatus(selectedTask.status)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-dark-slate">
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-50 px-3 py-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${presenceTone(patientPresence.isOnline)}`} />
                    You: {patientPresence.statusText}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-50 px-3 py-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${presenceTone(volunteerPresence.isOnline)}`} />
                    {volunteerPresence.label}: {volunteerPresence.statusText}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto py-5">
                {chatLoading && chatMessages.length === 0 && (
                  <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                    Loading chat messages...
                  </div>
                )}

                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm font-medium ${
                      message.author === 'user'
                        ? 'ml-auto bg-primary-blue text-white'
                        : message.author === 'system'
                          ? 'bg-surface-50 text-light-slate'
                          : 'border border-surface-200 bg-white text-dark-slate'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">
                      {message.author === 'user' && <Send className="h-3 w-3" />}
                      {message.author === 'volunteer' && <CircleDot className="h-3 w-3" />}
                      {message.author === 'system' && <BellRing className="h-3 w-3" />}
                      {message.senderName ?? message.author}
                    </div>
                    <p>{message.body}</p>
                    <p className="mt-2 text-[11px] font-bold opacity-75">{message.timestamp}</p>
                  </div>
                ))}

                {volunteerPresence.isTyping && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-50 px-3 py-2 text-xs font-bold text-light-slate">
                    <span className="h-2 w-2 rounded-full bg-primary-blue" />
                    {volunteerPresence.label} is typing...
                  </div>
                )}

                {!chatLoading && chatMessages.length === 0 && (
                  <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                    This chat is ready. Send the first message whenever you are ready.
                  </div>
                )}
              </div>

              <div className="border-t border-surface-200 pt-4">
                <div className="mb-4 rounded-[1.6rem] bg-surface-50 p-4 text-sm font-medium text-light-slate">
                  Keep each scheme in its own thread so different volunteers can guide you independently.
                </div>
                <div className="flex gap-3">
                  <input
                    value={chatDraft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder={`Message ${volunteerPresence.label || 'your volunteer'}...`}
                    className="flex-1 rounded-full border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-dark-slate focus:border-primary-blue focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSendMessage()}
                    className="rounded-full bg-primary-blue px-5 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <MessageSquareText className="mx-auto mb-3 h-10 w-10 text-primary-blue" />
                <p className="text-sm font-bold text-dark-slate">No chat selected</p>
                <p className="mt-1 text-sm font-medium text-light-slate">
                  Open a thread from Support Requests after a volunteer connects to your case.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
