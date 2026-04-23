'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export type AvailabilityStatus = 'Available' | 'Focused' | 'Offline';
export type TaskStatus = 'Assigned' | 'Active' | 'Completed' | 'Open';

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

const INITIAL_TASKS: VolunteerTask[] = [
  {
    id: 'task-201',
    title: 'Help caregiver complete PM-JAY eligibility documents',
    summary: 'Guide the family through missing form fields and upload checklist for scheme access.',
    assistanceType: 'Documentation Support',
    urgency: 'Critical',
    status: 'Assigned',
    estimatedTime: '2 hrs',
    source: 'NGO assigned',
    skills: ['Form Filling', 'Documentation', 'Legal Literacy'],
  },
  {
    id: 'task-202',
    title: 'Explain discharge notes and next referral steps',
    summary: 'Break down the report, clarify next appointments, and outline where to go next.',
    assistanceType: 'Care Guidance',
    urgency: 'High',
    status: 'Open',
    estimatedTime: '45 min',
    source: 'Independent pool',
    skills: ['Care Navigation', 'Counselling'],
  },
  {
    id: 'task-203',
    title: 'Locate urgent travel support for specialist visit',
    summary: 'Help family identify transport and reimbursement options before tomorrow morning.',
    assistanceType: 'Financial Assistance',
    urgency: 'Critical',
    status: 'Open',
    estimatedTime: '1 hr',
    source: 'Independent pool',
    skills: ['Scheme Awareness', 'Documentation'],
  },
];

const INITIAL_CHAT_THREADS: Record<string, ChatMessage[]> = {
  'task-201': [
    {
      id: 'msg-1',
      author: 'system',
      body: "You've been matched with a support navigator. Case chat is now active.",
      timestamp: '09:02',
    },
  ],
};

type VolunteerDashboardContextValue = {
  name: string;
  isNgoLinked: boolean;
  availability: AvailabilityStatus;
  setAvailability: (value: AvailabilityStatus) => void;
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
  acceptTask: (taskId: string) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  sendMessage: (body: string) => void;
};

const VolunteerDashboardContext = createContext<VolunteerDashboardContextValue | null>(null);

export function urgencyTone(urgency: VolunteerTask['urgency']) {
  if (urgency === 'Critical') return 'bg-primary-blue text-white border-primary-blue';
  if (urgency === 'High') return 'bg-brand-blue-50 text-primary-blue border-brand-blue-100';
  return 'bg-brand-slate-50 text-light-slate border-brand-slate-100';
}

export function statusTone(status: TaskStatus) {
  if (status === 'Assigned') return 'bg-brand-blue-50 text-primary-blue';
  if (status === 'Active') return 'bg-primary-blue text-white';
  if (status === 'Completed') return 'bg-brand-slate-100 text-light-slate';
  return 'bg-brand-slate-50 text-light-slate';
}

export function VolunteerDashboardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const firstName = (profile as unknown as Record<string, unknown> | null)?.firstName;
  const name = (typeof firstName === 'string' && firstName) || profile?.displayName?.split(' ')[0] || 'Volunteer';
  const isNgoLinked = Boolean((profile as Record<string, unknown> | null)?.orgName);
  const [availability, setAvailability] = useState<AvailabilityStatus>('Available');
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_THREADS);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('task-201');

  const assignedTasks = tasks.filter((task) => task.status === 'Assigned' || task.status === 'Active');
  const openTasks = tasks.filter((task) => task.status === 'Open');
  const completedTasks = tasks.filter((task) => task.status === 'Completed');
  const selectedTask = tasks.find((task) => task.id === selectedTaskId && task.status !== 'Open') ?? null;
  const chatMessages = useMemo(() => {
    return selectedTaskId ? chatThreads[selectedTaskId] ?? [] : [];
  }, [chatThreads, selectedTaskId]);
  const canAcceptOpenTasks = !isNgoLinked;
  const hasActiveWork = assignedTasks.some((task) => task.status === 'Assigned' || task.status === 'Active');

  const acceptTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'Assigned',
              assignedVolunteer: name,
              caseLocked: true,
              userNotice: "You've been matched with a support navigator.",
            }
          : task
      )
    );

    setChatThreads((current) => ({
      ...current,
      [taskId]: [
        {
          id: `${taskId}-system`,
          author: 'system',
          body: "You've been matched with a support navigator. Case chat is now active.",
          timestamp: 'Now',
        },
      ],
    }));

    setSelectedTaskId(taskId);
  }, [name]);

  const startTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: 'Active', caseLocked: true }
          : task
      )
    );

    setChatThreads((current) => ({
      ...current,
      [taskId]: [
        ...(current[taskId] ?? []),
        {
          id: `${taskId}-volunteer-start`,
          author: 'volunteer',
          body: 'Hello, I have started working on your case. I will guide you through the next steps here, and you can reply whenever you are available.',
          timestamp: 'Now',
        },
      ],
    }));

    setSelectedTaskId(taskId);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: 'Completed' }
          : task
      )
    );
  }, []);

  const sendMessage = useCallback((body: string) => {
    if (!selectedTaskId || !body.trim()) return;

    setChatThreads((current) => ({
      ...current,
      [selectedTaskId]: [
        ...(current[selectedTaskId] ?? []),
        {
          id: `${selectedTaskId}-${Date.now()}`,
          author: 'volunteer',
          body: body.trim(),
          timestamp: 'Now',
        },
      ],
    }));
  }, [selectedTaskId]);

  const value = useMemo(
    () => ({
      name,
      isNgoLinked,
      availability,
      setAvailability,
      tasks,
      assignedTasks,
      openTasks,
      completedTasks,
      canAcceptOpenTasks,
      hasActiveWork,
      selectedTaskId,
      setSelectedTaskId,
      selectedTask,
      chatMessages,
      acceptTask,
      startTask,
      completeTask,
      sendMessage,
    }),
    [
      name,
      isNgoLinked,
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
      sendMessage,
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
