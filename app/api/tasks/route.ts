import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// In production this writes to Firestore via Admin SDK.
// For now it accepts and echoes the task with a generated ID.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const task = {
      task_id:          randomUUID(),
      type:             body.type             ?? 'general',
      urgency_score:    body.urgency_score    ?? 0.5,
      required_skills:  body.required_skills  ?? [],
      priority:         body.priority         ?? 'medium',
      fallback_strategy: body.fallback_strategy ?? ['volunteer', 'ngo', 'self', 'queue'],
      userId:           body.userId           ?? null,
      category:         body.category         ?? null,
      status:           'pending',
      createdAt:        new Date().toISOString(),
    };
    // TODO: await adminDb.collection('tasks').doc(task.task_id).set(task);
    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task creation failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  // TODO: query Firestore for tasks where userId matches
  return NextResponse.json({ tasks: [], userId });
}
