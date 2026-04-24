import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializeValue(entry)])
  );
}

export async function GET(_: NextRequest, context: RouteContext<'/api/tasks/[taskId]/messages'>) {
  try {
    const { taskId } = await context.params;
    const snap = await adminDb.collection('tasks').doc(taskId).collection('messages').orderBy('createdAt', 'asc').get();
    const messages = snap.docs.map((doc) => ({
      id: doc.id,
      ...(serializeValue(doc.data()) as Record<string, unknown>),
    }));

    return NextResponse.json({ messages, taskId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load messages.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext<'/api/tasks/[taskId]/messages'>) {
  try {
    const { taskId } = await context.params;
    const body = await req.json();
    const author = asString(body.author) || 'system';
    const senderId = asString(body.senderId) || null;
    const senderName = asString(body.senderName) || null;
    const text = asString(body.body);

    if (!text) {
      return NextResponse.json({ error: 'body is required.' }, { status: 400 });
    }

    const ref = adminDb.collection('tasks').doc(taskId).collection('messages').doc();
    await ref.set({
      author,
      senderId,
      senderName,
      body: text,
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    });

    await adminDb.collection('tasks').doc(taskId).set(
      {
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send message.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
