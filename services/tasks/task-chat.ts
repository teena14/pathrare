export type SupportTask = {
  id: string;
  title: string;
  summary: string;
  status: string;
  category?: string;
  resourceId?: string;
  resourceName?: string;
  type?: string;
  assignedVolunteerId?: string | null;
  assignedVolunteerName?: string | null;
  requestStatus?: string;
  userId?: string | null;
  userName?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ChatMessage = {
  id: string;
  author: 'user' | 'volunteer' | 'system';
  body: string;
  senderName: string | null;
  timestamp: string;
};

export type PresenceParticipant = {
  role: 'user' | 'volunteer';
  label: string;
  isOnline: boolean;
  isTyping: boolean;
  statusText: string;
  lastSeenAt: string | null;
};

export type TaskPresenceSnapshot = {
  user: PresenceParticipant;
  volunteer: PresenceParticipant;
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown) {
  const normalized = asString(value);
  return normalized || null;
}

function normalizeKeyPart(value: unknown) {
  return asString(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function humanizeTaskStatus(status: unknown) {
  return asString(status).replace(/_/g, ' ') || 'pending';
}

export function canOpenTaskChat(status: unknown) {
  const normalized = asString(status).toLowerCase();
  return ['active', 'in_progress', 'completed', 'resolved'].includes(normalized);
}

export function mapSupportTask(task: Record<string, unknown>): SupportTask {
  return {
    id: asString(task.id ?? task.task_id),
    title: asString(task.title) || 'Support request',
    summary: asString(task.summary ?? task.description),
    status: asString(task.status) || 'pending',
    category: asString(task.category) || undefined,
    resourceId: asString(task.resourceId) || undefined,
    resourceName: asString(task.resourceName) || undefined,
    type: asString(task.type) || undefined,
    assignedVolunteerId: asNullableString(task.assignedVolunteerId),
    assignedVolunteerName: asNullableString(task.assignedVolunteerName),
    requestStatus: asString(task.requestStatus) || undefined,
    userId: asNullableString(task.userId),
    userName: asNullableString(task.userName),
    lastMessageAt: asNullableString(task.lastMessageAt),
    createdAt: asNullableString(task.createdAt),
    updatedAt: asNullableString(task.updatedAt),
  };
}

function getSupportTaskDeduplicationKey(task: SupportTask) {
  const category = normalizeKeyPart(task.category);
  const resourceId = normalizeKeyPart(task.resourceId);
  const resourceName = normalizeKeyPart(task.resourceName);
  const title = normalizeKeyPart(task.title);

  return `${category}::${resourceId || resourceName || title || task.id}`;
}

function getSupportTaskPriority(task: SupportTask) {
  return [
    canOpenTaskChat(task.status) ? 1 : 0,
    task.assignedVolunteerId ? 1 : 0,
    Date.parse(task.updatedAt ?? task.createdAt ?? '') || 0,
  ] as const;
}

function shouldReplaceTask(current: SupportTask, incoming: SupportTask) {
  const currentPriority = getSupportTaskPriority(current);
  const incomingPriority = getSupportTaskPriority(incoming);

  for (let index = 0; index < currentPriority.length; index += 1) {
    if (incomingPriority[index] > currentPriority[index]) {
      return true;
    }

    if (incomingPriority[index] < currentPriority[index]) {
      return false;
    }
  }

  return false;
}

export function dedupeSupportTasks(tasks: SupportTask[]) {
  const deduped = new Map<string, SupportTask>();

  for (const task of tasks) {
    const key = getSupportTaskDeduplicationKey(task);
    const existing = deduped.get(key);

    if (!existing || shouldReplaceTask(existing, task)) {
      deduped.set(key, task);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? '') || 0;
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? '') || 0;
    return rightTime - leftTime;
  });
}

export function formatChatTimestamp(value: unknown) {
  if (!value) return 'Now';

  const date = new Date(typeof value === 'string' ? value : String(value));
  if (Number.isNaN(date.getTime())) return 'Now';

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  return date.toLocaleString([], {
    month: isSameDay ? undefined : 'short',
    day: isSameDay ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mapChatMessage(message: Record<string, unknown>): ChatMessage {
  const author = message.author === 'volunteer' || message.author === 'user' ? message.author : 'system';

  return {
    id: asString(message.id),
    author,
    body: asString(message.body),
    senderName: asNullableString(message.senderName),
    timestamp: formatChatTimestamp(message.createdAtIso ?? message.createdAt),
  };
}

export function defaultPresenceParticipant(role: 'user' | 'volunteer'): PresenceParticipant {
  return {
    role,
    label: role === 'user' ? 'Patient' : 'Volunteer',
    isOnline: false,
    isTyping: false,
    statusText: role === 'volunteer' ? 'Waiting to connect' : 'Offline',
    lastSeenAt: null,
  };
}

export function defaultPresenceSnapshot(): TaskPresenceSnapshot {
  return {
    user: defaultPresenceParticipant('user'),
    volunteer: defaultPresenceParticipant('volunteer'),
  };
}
