'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/auth-provider';
import { db } from '@/services/firebase/firebase';
import { getAssociatedNgoIds, toAvailabilityLabel } from '@/services/ngo/ngo-associations';

export type AvailabilityStatus = 'Available' | 'Busy' | 'Offline';
export type TaskStatus = 'Pending' | 'Assigned' | 'Active' | 'Completed' | 'Open';

export type VolunteerTask = {
  id: string;
  title: string;
  summary: string;
  assistanceType: string;
  urgency: 'Critical' | 'High' | 'Moderate';
  status: TaskStatus;
  estimatedTime: string;
  source: 'NGO assigned' | 'Independent pool';
  skills: string[];
  ngoId?: string | null;
  assignedVolunteer?: string;
  caseLocked?: boolean;
  userNotice?: string;
};

export type ChatMessage = {
  id: string;
  author: 'volunteer' | 'system' | 'user';
  body: string;
  timestamp: string;
};

type VolunteerDashboardContextValue = {
  loading: boolean;
  name: string;
  isNgoLinked: boolean;
  associatedNgoIds: string[];
  availability: AvailabilityStatus;
  setAvailability: (value: AvailabilityStatus) => Promise<void>;
  tasks: VolunteerTask[];
  assignedTasks: VolunteerTask[];
  openTasks: VolunteerTask[];
  completedTasks: VolunteerTask[];
  canAcceptOpenTasks: boolean;
  hasActiveWork: boolean;
  selectedTaskId: string;
  setSelectedTaskId: (value: string) => void;
  selectedTask: VolunteerTask | null;
  chatMessages: ChatMessage[];
  acceptTask: (taskId: string) => Promise<void>;
  startTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
};

const VolunteerDashboardContext = createContext<VolunteerDashboardContextValue | null>(null);

function mapUrgency(score: unknown): VolunteerTask['urgency'] {
  const value = Number(score ?? 0);
  if (value >= 0.85) return 'Critical';
  if (value >= 0.6) return 'High';
  return 'Moderate';
}

function mapStatus(status: unknown, isCandidateOffer: boolean): TaskStatus {
  const value = String(status ?? '').toLowerCase();
  if (isCandidateOffer && (value === 'pending' || value === 'open' || value === 'unassigned')) return 'Pending';
  if (value === 'assigned' || value === 'accepted') return 'Assigned';
  if (value === 'active' || value === 'in_progress') return 'Active';
  if (value === 'completed' || value === 'resolved') return 'Completed';
  return 'Open';
}

function toTimestamp(value: unknown) {
  if (typeof value === 'string' && value) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return 'Now';
}

export function urgencyTone(urgency: VolunteerTask['urgency']) {
  if (urgency === 'Critical') return 'bg-primary-blue text-white border-primary-blue';
  if (urgency === 'High') return 'bg-brand-blue-50 text-primary-blue border-brand-blue-100';
  return 'bg-brand-slate-50 text-light-slate border-brand-slate-100';
}

export function statusTone(status: TaskStatus) {
  if (status === 'Pending') return 'bg-amber-50 text-amber-700';
  if (status === 'Assigned') return 'bg-brand-blue-50 text-primary-blue';
  if (status === 'Active') return 'bg-primary-blue text-white';
  if (status === 'Completed') return 'bg-brand-slate-100 text-light-slate';
  return 'bg-brand-slate-50 text-light-slate';
}

export function VolunteerDashboardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const profileUid = profile?.uid ?? '';
  const firstName = (profile as Record<string, unknown> | null)?.firstName;
  const name = (typeof firstName === 'string' && firstName) || profile?.displayName?.split(' ')[0] || 'Volunteer';
  const profileRecord = (profile as Record<string, unknown> | null) ?? null;
  const [loading, setLoading] = useState(true);
  const [availability, setAvailabilityState] = useState<AvailabilityStatus>(() => toAvailabilityLabel(profileRecord?.availability));
  const [associatedNgoIds, setAssociatedNgoIds] = useState<string[]>(() => getAssociatedNgoIds(profileRecord));
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const isNgoLinked = associatedNgoIds.length > 0;
  const assignedTasks = tasks.filter((task) => task.status === 'Pending' || task.status === 'Assigned' || task.status === 'Active');
  const openTasks = tasks.filter((task) => task.status === 'Open');
  const completedTasks = tasks.filter((task) => task.status === 'Completed');
  const selectedTask = tasks.find((task) => task.id === selectedTaskId && task.status !== 'Open') ?? null;
  const hasActiveWork = assignedTasks.some((task) => task.status === 'Assigned' || task.status === 'Active');
  const canAcceptOpenTasks = availability === 'Available' && !hasActiveWork;

  const loadTasks = useCallback(async () => {
    if (!profileUid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/tasks?volunteerId=${encodeURIComponent(profileUid)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load tasks.');
    }

    const nextTasks = Array.isArray(data.tasks)
      ? data.tasks.map((task: Record<string, unknown>) => {
          const isCandidateOffer =
            typeof task.candidateVolunteerId === 'string' &&
            task.candidateVolunteerId === profileUid &&
            !task.assignedVolunteerId;

          return {
            id: String(task.id ?? task.task_id),
            title: String(task.title ?? 'Support request'),
            summary: String(task.summary ?? task.description ?? ''),
            assistanceType: String(task.category ?? task.needType ?? 'General support'),
            urgency: mapUrgency(task.urgency_score),
            status: mapStatus(task.status, isCandidateOffer),
            estimatedTime: 'Varies',
            source: task.ngoId ? 'NGO assigned' : 'Independent pool',
            skills: Array.isArray(task.required_skills) ? task.required_skills.map(String) : [],
            ngoId: typeof task.ngoId === 'string' ? task.ngoId : null,
            assignedVolunteer: typeof task.assignedVolunteerName === 'string' ? task.assignedVolunteerName : undefined,
            caseLocked: Boolean(task.assignedVolunteerId),
            userNotice: isCandidateOffer
              ? 'Your NGO shortlisted this case for you. Accept it to lock the case and notify the patient.'
              : typeof task.summary === 'string'
                ? task.summary
                : undefined,
          } satisfies VolunteerTask;
        })
      : [];

    setTasks(nextTasks);
    setSelectedTaskId((current) => {
      if (current && nextTasks.some((task: VolunteerTask) => task.id === current)) return current;
      return (
        nextTasks.find(
          (task: VolunteerTask) => task.status === 'Assigned' || task.status === 'Active' || task.status === 'Completed'
        )?.id ?? ''
      );
    });
    setLoading(false);
  }, [profileUid]);

  const loadProfileState = useCallback(async () => {
    if (!profileUid) {
      return;
    }

    const snapshot = await getDoc(doc(db, 'users', profileUid));
    if (!snapshot.exists()) {
      return;
    }

    const userData = (snapshot.data() ?? {}) as Record<string, unknown>;
    setAvailabilityState(toAvailabilityLabel(userData.availability));
    setAssociatedNgoIds(getAssociatedNgoIds(userData));
  }, [profileUid]);

  const loadMessages = useCallback(async () => {
    if (!selectedTaskId) {
      setChatMessages([]);
      return;
    }

    const response = await fetch(`/api/tasks/${encodeURIComponent(selectedTaskId)}/messages`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load messages.');
    }

    const nextMessages = Array.isArray(data.messages)
      ? data.messages.map((message: Record<string, unknown>) => ({
          id: String(message.id),
          author: message.author === 'volunteer' || message.author === 'user' ? message.author : 'system',
          body: String(message.body ?? ''),
          timestamp: toTimestamp(message.createdAtIso ?? message.createdAt),
        }))
      : [];

    setChatMessages(nextMessages);
  }, [selectedTaskId]);

  useEffect(() => {
    if (!profileUid) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadProfileState();
    }, 0);
    const interval = window.setInterval(() => {
      void loadProfileState();
    }, 12000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [loadProfileState, profileUid]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadTasks();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setLoading(false);
        }
      }
    };

    void run();

    if (!profileUid) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void run();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadTasks, profileUid]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadMessages();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void run();

    if (!selectedTaskId) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void run();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadMessages, selectedTaskId]);

  const persistAvailability = useCallback(async (value: AvailabilityStatus) => {
    if (!profileUid) return;

    await updateDoc(doc(db, 'users', profileUid), {
      availability: value.toLowerCase(),
      updatedAt: new Date().toISOString(),
    });
    setAvailabilityState(value);
  }, [profileUid]);

  const acceptTask = useCallback(async (taskId: string) => {
    if (!profileUid) return;
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        status: 'assigned',
        assignedVolunteerId: profileUid,
        assignedVolunteerName: name,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to accept task.');
    }
    setSelectedTaskId(taskId);
    await loadTasks();
    await loadProfileState();
  }, [loadProfileState, loadTasks, name, profileUid]);

  const startTask = useCallback(async (taskId: string) => {
    if (!profileUid) return;
    const taskResponse = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        status: 'in_progress',
        assignedVolunteerId: profileUid,
        assignedVolunteerName: name,
        lastInterventionAt: new Date().toISOString(),
      }),
    });
    const taskData = await taskResponse.json();
    if (!taskResponse.ok) {
      throw new Error(taskData.error ?? 'Failed to start task.');
    }

    const messageResponse = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: 'volunteer',
        senderId: profileUid,
        senderName: name,
        body: 'Hello, I have started working on your case. I will guide you through the next steps here, and you can reply whenever you are available.',
      }),
    });
    const messageData = await messageResponse.json();
    if (!messageResponse.ok) {
      throw new Error(messageData.error ?? 'Failed to post task-start message.');
    }
    setSelectedTaskId(taskId);
    await loadTasks();
    await loadMessages();
  }, [loadMessages, loadTasks, name, profileUid]);

  const completeTask = useCallback(async (taskId: string) => {
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        status: 'completed',
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to complete task.');
    }
    await loadTasks();
    await loadProfileState();
  }, [loadProfileState, loadTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!profileUid) return;

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'archive',
        taskId,
        actorRole: 'volunteer',
        actorId: profileUid,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to delete task from dashboard.');
    }

    if (selectedTaskId === taskId) {
      setSelectedTaskId('');
    }
    await loadTasks();
  }, [loadTasks, profileUid, selectedTaskId]);

  const sendMessage = useCallback(async (body: string) => {
    if (!selectedTaskId || !body.trim() || !profileUid) return;
    const response = await fetch(`/api/tasks/${encodeURIComponent(selectedTaskId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: 'volunteer',
        senderId: profileUid,
        senderName: name,
        body: body.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to send message.');
    }
    await loadMessages();
  }, [loadMessages, name, profileUid, selectedTaskId]);

  const value = useMemo(
    () => ({
      loading,
      name,
      isNgoLinked,
      associatedNgoIds,
      availability,
      setAvailability: persistAvailability,
      tasks,
      assignedTasks,
      openTasks,
      completedTasks,
      canAcceptOpenTasks,
      hasActiveWork,
      selectedTaskId,
      setSelectedTaskId,
      selectedTask,
      chatMessages: selectedTaskId ? chatMessages : [],
      acceptTask,
      startTask,
      completeTask,
      deleteTask,
      sendMessage,
      refreshTasks: loadTasks,
    }),
    [
      loading,
      name,
      isNgoLinked,
      associatedNgoIds,
      availability,
      tasks,
      assignedTasks,
      openTasks,
      completedTasks,
      canAcceptOpenTasks,
      hasActiveWork,
      selectedTaskId,
      selectedTask,
      chatMessages,
      acceptTask,
      startTask,
      completeTask,
      deleteTask,
      sendMessage,
      loadTasks,
      persistAvailability,
    ]
  );

  return <VolunteerDashboardContext.Provider value={value}>{children}</VolunteerDashboardContext.Provider>;
}

export function useVolunteerDashboard() {
  const context = useContext(VolunteerDashboardContext);
  if (!context) {
    throw new Error('useVolunteerDashboard must be used within VolunteerDashboardProvider');
  }

  return context;
}
