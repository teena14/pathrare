import { NextRequest, NextResponse } from 'next/server';

interface Task {
  task_id: string;
  urgency_score: number;
  required_skills: string[];
  fallback_strategy: string[];
  userId?: string;
}

interface AllocationResult {
  tier: 1 | 2 | 3 | 4;
  assigned_to: string | null;
  message: string;
  fallback_used: string;
}

// Priority Score = (Urgency × 0.4) + (Risk × 0.3) + (Delay Impact × 0.2) + (Access Gap × 0.1)
function computePriority(urgency: number): number {
  const risk   = urgency > 0.8 ? 1.0 : urgency > 0.6 ? 0.7 : 0.4;
  const delay  = urgency > 0.8 ? 0.9 : 0.5;
  const access = 0.6;
  return +(urgency * 0.4 + risk * 0.3 + delay * 0.2 + access * 0.1).toFixed(3);
}

// Multi-tier allocation logic
async function allocate(task: Task): Promise<AllocationResult> {
  const priorityScore = computePriority(task.urgency_score);
  const strategy      = task.fallback_strategy ?? ['volunteer', 'ngo', 'self', 'queue'];

  // Tier 1: Check for available volunteers (simulated)
  if (strategy.includes('volunteer') && Math.random() > 0.4) {
    return {
      tier: 1,
      assigned_to: `volunteer_${Math.floor(Math.random() * 100)}`,
      message: 'Volunteer matched and notified.',
      fallback_used: 'volunteer',
    };
  }

  // Tier 2: Route to NGO
  if (strategy.includes('ngo') && Math.random() > 0.4) {
    return {
      tier: 2,
      assigned_to: `ngo_${Math.floor(Math.random() * 10)}`,
      message: 'Task routed to partner NGO.',
      fallback_used: 'ngo',
    };
  }

  // Tier 3: Self-guided
  if (strategy.includes('self')) {
    return {
      tier: 3,
      assigned_to: null,
      message: 'Self-guided steps provided to user.',
      fallback_used: 'self',
    };
  }

  // Tier 4: Queue
  return {
    tier: 4,
    assigned_to: null,
    message: 'Task queued. User will be notified when a resource becomes available.',
    fallback_used: 'queue',
  };
}

export async function POST(req: NextRequest) {
  try {
    const task: Task = await req.json();
    if (!task.task_id) {
      return NextResponse.json({ error: 'task_id is required.' }, { status: 400 });
    }
    const result = await allocate(task);
    // TODO: update Firestore task doc with allocation result
    return NextResponse.json({ success: true, allocation: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Allocation failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
