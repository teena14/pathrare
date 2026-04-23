import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value: unknown) {
  const status = cleanString(value).toLowerCase();
  if (['assigned', 'active', 'in_progress', 'completed', 'resolved', 'pending'].includes(status)) {
    return status;
  }
  return 'pending';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const taskId = cleanString(body.task_id) || randomUUID();
    const task = {
      task_id:          taskId,
      type:             body.type             ?? 'general',
      urgency_score:    body.urgency_score    ?? 0.5,
      required_skills:  body.required_skills  ?? [],
      priority:         body.priority         ?? 'medium',
      fallback_strategy: body.fallback_strategy ?? ['volunteer', 'ngo', 'self', 'queue'],
      userId:           body.userId           ?? null,
      category:         body.category         ?? null,
      title:            body.title            ?? null,
      summary:          body.summary          ?? body.description ?? null,
      status:           normalizeStatus(body.status),
      assignedVolunteerId: body.assignedVolunteerId ?? null,
      lastInterventionAt: body.lastInterventionAt ?? null,
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    };

    await adminDb.collection('tasks').doc(taskId).set(task, { merge: true });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task creation failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  try {
    let query: FirebaseFirestore.Query = adminDb.collection('tasks');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    const tasks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ tasks, userId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task lookup failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const taskId = cleanString(body.taskId ?? body.task_id);

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    if ('status' in body) patch.status = normalizeStatus(body.status);
    if ('assignedVolunteerId' in body) patch.assignedVolunteerId = body.assignedVolunteerId || null;
    if ('lastInterventionAt' in body) patch.lastInterventionAt = body.lastInterventionAt || null;

    await adminDb.collection('tasks').doc(taskId).set(patch, { merge: true });

    return NextResponse.json({ success: true, taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task update failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
