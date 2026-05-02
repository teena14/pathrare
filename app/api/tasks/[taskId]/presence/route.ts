import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';
import {
  defaultPresenceParticipant,
  TaskPresenceSnapshot,
} from '@/services/tasks/task-chat';

export const dynamic = 'force-dynamic';

const ONLINE_WINDOW_MS = 25000;
const TYPING_WINDOW_MS = 7000;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getDisplayName(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return '';

  const firstName = asString(profile.firstName);
  const lastName = asString(profile.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || asString(profile.displayName);
}

function formatLastSeen(value: string | null) {
  if (!value) return 'Not in chat yet';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Not in chat yet';

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 60000) return 'Last seen just now';

  const elapsedMinutes = Math.round(elapsedMs / 60000);
  if (elapsedMinutes < 60) {
    return `Last seen ${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Last seen ${elapsedHours}h ago`;
  }

  return `Last seen ${new Date(value).toLocaleDateString()}`;
}

function buildParticipantPresence({
  role,
  presenceDoc,
  label,
  isAssigned,
}: {
  role: 'user' | 'volunteer';
  presenceDoc: Record<string, unknown> | null;
  label: string;
  isAssigned: boolean;
}) {
  const fallback = defaultPresenceParticipant(role);
  const lastSeenAt = asString(presenceDoc?.lastSeenAt) || null;
  const typingUntil = asString(presenceDoc?.typingUntil) || null;
  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  const typingUntilTime = typingUntil ? new Date(typingUntil).getTime() : NaN;
  const isOnline = Number.isFinite(lastSeenTime) && Date.now() - lastSeenTime <= ONLINE_WINDOW_MS;
  const isTyping = isOnline && Number.isFinite(typingUntilTime) && typingUntilTime > Date.now();

  return {
    ...fallback,
    label: label || fallback.label,
    isOnline,
    isTyping,
    lastSeenAt,
    statusText: isTyping
      ? 'Typing...'
      : isOnline
        ? 'Online'
        : !isAssigned && role === 'volunteer'
          ? 'Waiting to connect'
          : formatLastSeen(lastSeenAt),
  };
}

async function loadPresence(taskId: string): Promise<TaskPresenceSnapshot> {
  const taskRef = adminDb.collection('tasks').doc(taskId);
  const taskSnap = await taskRef.get();

  if (!taskSnap.exists) {
    throw new Error('Task not found.');
  }

  const task = (taskSnap.data() ?? {}) as Record<string, unknown>;
  const userId = asString(task.userId);
  const volunteerId = asString(task.assignedVolunteerId);

  const [presenceSnap, userSnap, volunteerSnap] = await Promise.all([
    taskRef.collection('presence').get(),
    userId ? adminDb.collection('users').doc(userId).get() : null,
    volunteerId ? adminDb.collection('users').doc(volunteerId).get() : null,
  ]);

  const presenceLookup = new Map(
    presenceSnap.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>])
  );
  const userProfile = userSnap?.exists ? (userSnap.data() as Record<string, unknown>) : null;
  const volunteerProfile = volunteerSnap?.exists ? (volunteerSnap.data() as Record<string, unknown>) : null;

  return {
    user: buildParticipantPresence({
      role: 'user',
      presenceDoc: presenceLookup.get('user') ?? null,
      label: asString(task.userName) || getDisplayName(userProfile) || 'Patient',
      isAssigned: true,
    }),
    volunteer: buildParticipantPresence({
      role: 'volunteer',
      presenceDoc: presenceLookup.get('volunteer') ?? null,
      label: asString(task.assignedVolunteerName) || getDisplayName(volunteerProfile) || 'Volunteer',
      isAssigned: Boolean(volunteerId),
    }),
  };
}

export async function GET(_: NextRequest, context: RouteContext<'/api/tasks/[taskId]/presence'>) {
  try {
    const { taskId } = await context.params;
    const presence = await loadPresence(taskId);
    return NextResponse.json({ presence, taskId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load participant status.';
    const status = message === 'Task not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest, context: RouteContext<'/api/tasks/[taskId]/presence'>) {
  try {
    const { taskId } = await context.params;
    const taskRef = adminDb.collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const role = asString(body.role) === 'volunteer' ? 'volunteer' : 'user';
    const now = new Date();
    const nowIso = now.toISOString();

    await taskRef.collection('presence').doc(role).set(
      {
        role,
        lastSeenAt: nowIso,
        typingUntil: body.typing ? new Date(now.getTime() + TYPING_WINDOW_MS).toISOString() : nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    const presence = await loadPresence(taskId);
    return NextResponse.json({ success: true, presence, taskId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update participant status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
