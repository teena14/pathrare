import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { task_id?: string };

    if (!body.task_id) {
      return NextResponse.json({ error: 'task_id is required.' }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Legacy allocator disabled. Use /api/tasks and the Firestore-backed assignment flow instead.',
      },
      { status: 410 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Allocation failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
