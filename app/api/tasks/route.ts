import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getAssociatedNgoIds, normalizeAvailability } from '@/services/ngo/ngo-associations';
import {
  acceptRequestOwnership,
  assignNgoCandidate,
  createSupportWorkflow,
} from '@/services/tasks/support-workflow';

export const dynamic = 'force-dynamic';

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => cleanString(entry)).filter(Boolean) : [];
}

function normalizeComparableString(value: unknown) {
  return cleanString(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function isTaskArchivedForVolunteer(task: Record<string, unknown>, volunteerId: string) {
  return cleanStringArray(task.hiddenFromVolunteerIds).includes(volunteerId);
}

function normalizeStatus(value: unknown) {
  const status = cleanString(value).toLowerCase();
  if (
    [
      'assigned',
      'active',
      'in_progress',
      'completed',
      'resolved',
      'pending',
      'open',
      'accepted',
      'unassigned',
    ].includes(status)
  ) {
    return status;
  }
  return 'pending';
}

function normalizeNeedType(value: unknown) {
  const needType = cleanString(value).toLowerCase();
  if (['medical', 'financial', 'education', 'assistive'].includes(needType)) {
    return needType;
  }
  return 'medical';
}

function normalizeLocation(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { country: null, state: null, city: null };
  }

  const record = value as Record<string, unknown>;
  return {
    country: cleanString(record.country) || null,
    state: cleanString(record.state) || null,
    city: cleanString(record.city) || null,
  };
}

const NEED_TYPE_SKILL_HINTS: Record<string, string[]> = {
  financial: ['financial aid', 'legal literacy', 'form filling', 'documentation', 'data entry', 'scheme awareness'],
  medical: ['medical escort', 'care navigation', 'translation', 'counselling', 'support'],
  education: ['education', 'counselling', 'translation', 'support'],
  assistive: ['tech support', 'assistive', 'device support', 'translation', 'support'],
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasTokenOverlap(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  return aTokens.some((token) => bTokens.includes(token));
}

function volunteerMatchesTask(task: Record<string, unknown>, volunteerSkills: string[]) {
  const requiredSkills = cleanStringArray(task.required_skills).map((skill) => skill.toLowerCase());
  const needType = normalizeNeedType(task.needType ?? task.category);
  const hintedSkills = NEED_TYPE_SKILL_HINTS[needType] ?? [];
  const wanted = [...requiredSkills, ...hintedSkills];

  if (wanted.length === 0) {
    return true;
  }

  if (volunteerSkills.length === 0) {
    return false;
  }

  return wanted.some((wantedSkill) =>
    volunteerSkills.some((volunteerSkill) =>
      volunteerSkill === wantedSkill ||
      volunteerSkill.includes(wantedSkill) ||
      wantedSkill.includes(volunteerSkill) ||
      hasTokenOverlap(volunteerSkill, wantedSkill)
    )
  );
}

async function addSystemMessage(taskId: string, body: string) {
  await adminDb.collection('tasks').doc(taskId).collection('messages').add({
    author: 'system',
    senderId: null,
    senderName: 'PathRare',
    body,
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });
}

async function serializeTasks(query: FirebaseFirestore.Query) {
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<Record<string, unknown>>;
}

function matchesExistingTask(
  task: Record<string, unknown>,
  params: {
    userId: string;
    category: string;
    resourceId: string;
    resourceName: string;
    title: string;
  }
) {
  if (cleanString(task.userId) !== params.userId) {
    return false;
  }

  const taskCategory = normalizeNeedType(task.category ?? task.needType);
  if (taskCategory !== params.category) {
    return false;
  }

  const taskResourceId = cleanString(task.resourceId);
  if (params.resourceId && taskResourceId && taskResourceId === params.resourceId) {
    return true;
  }

  const taskNames = [
    normalizeComparableString(task.resourceName),
    normalizeComparableString(task.title),
  ].filter(Boolean);

  const incomingNames = [
    normalizeComparableString(params.resourceName),
    normalizeComparableString(params.title),
  ].filter(Boolean);

  return incomingNames.some((name) => taskNames.includes(name));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = cleanString(body.userId);

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const needType = normalizeNeedType(body.needType ?? body.category);
    const category = cleanString(body.category) || needType;
    const resourceId = cleanString(body.resourceId);
    const resourceName = cleanString(body.resourceName) || cleanString(body.title);
    const title = cleanString(body.title) || `Volunteer help for ${resourceName || 'support request'}`;
    const existingTasks = await serializeTasks(adminDb.collection('tasks').where('userId', '==', userId));
    const existingTask = existingTasks.find((task) =>
      matchesExistingTask(task, {
        userId,
        category: needType,
        resourceId,
        resourceName,
        title,
      })
    );

    if (existingTask) {
      return NextResponse.json(
        {
          success: true,
          reused: true,
          task: existingTask,
          caseId: cleanString(existingTask.caseId) || null,
          requestId: cleanString(existingTask.requestId) || null,
        },
        { status: 200 }
      );
    }

    const taskId = cleanString(body.task_id) || randomUUID();
    const caseId = cleanString(body.case_id) || taskId;
    const requestId = cleanString(body.request_id) || randomUUID();
    await createSupportWorkflow({
      taskId,
      caseId,
      requestId,
      userId,
      title: title || null,
      summary: cleanString(body.summary) || cleanString(body.description) || null,
      description: cleanString(body.description) || cleanString(body.summary) || null,
      type: cleanString(body.type) || 'general',
      category: category || null,
      needType,
      goal: cleanString(body.goal) || null,
      resourceId: resourceId || null,
      resourceName: resourceName || null,
      diseaseCluster: cleanString(body.diseaseCluster ?? body.conditionTag) || null,
      urgencyScore: Number(body.urgency_score ?? 0.5),
      requiredSkills: cleanStringArray(body.required_skills),
      fallbackStrategy: cleanStringArray(body.fallback_strategy).length
        ? cleanStringArray(body.fallback_strategy)
        : ['volunteer', 'ngo', 'queue'],
      location: normalizeLocation(body.location),
    });

    const taskSnap = await adminDb.collection('tasks').doc(taskId).get();
    return NextResponse.json(
      {
        success: true,
        task: taskSnap.data() ?? null,
        caseId,
        requestId,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task creation failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const volunteerId = req.nextUrl.searchParams.get('volunteerId');

  try {
    if (userId) {
      const tasks = await serializeTasks(adminDb.collection('tasks').where('userId', '==', userId));
      tasks.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      return NextResponse.json({ tasks, userId });
    }

    const tasks = await serializeTasks(adminDb.collection('tasks').orderBy('createdAt', 'desc'));

    if (!volunteerId) {
      return NextResponse.json({ tasks, volunteerId: null });
    }

    const volunteerDoc = await adminDb.collection('users').doc(volunteerId).get();
    const volunteer = (volunteerDoc.data() ?? {}) as Record<string, unknown>;
    const volunteerSkills = cleanStringArray(volunteer.skills).map((skill) => skill.toLowerCase());
    const volunteerNgoIds = getAssociatedNgoIds(volunteer);
    const canTakeWork =
      cleanString(volunteer.role).toLowerCase() === 'volunteer' &&
      normalizeAvailability(volunteer.availability) === 'available';
    const hasActiveAssignment = tasks.some((task) => {
      const assignedVolunteerId = cleanString(task.assignedVolunteerId);
      const status = cleanString(task.status).toLowerCase();
      return assignedVolunteerId === volunteerId && ['assigned', 'active', 'in_progress'].includes(status);
    });

    const filteredTasks = tasks.filter((task) => {
      if (isTaskArchivedForVolunteer(task, volunteerId)) {
        return false;
      }

      const assignedVolunteerId = cleanString(task.assignedVolunteerId);
      const candidateVolunteerId = cleanString(task.candidateVolunteerId);
      const taskNgoId = cleanString(task.ngoId);
      const status = cleanString(task.status).toLowerCase();
      const requestStatus = cleanString(task.requestStatus).toLowerCase();

      const isAssignedToVolunteer = assignedVolunteerId === volunteerId;
      const isNgoCandidate =
        candidateVolunteerId === volunteerId &&
        Boolean(taskNgoId) &&
        volunteerNgoIds.includes(taskNgoId) &&
        requestStatus === 'pending' &&
        (status === 'pending' || status === 'open' || status === 'unassigned');

      if (isAssignedToVolunteer || isNgoCandidate) {
        return true;
      }

      if (!canTakeWork || hasActiveAssignment || requestStatus !== 'pending') {
        return false;
      }

      if (status !== 'open' && status !== 'pending' && status !== 'unassigned') {
        return false;
      }

      const hasSkillMatch = volunteerMatchesTask(task, volunteerSkills);

      if (!hasSkillMatch) {
        return false;
      }

      if (taskNgoId) {
        return volunteerNgoIds.includes(taskNgoId);
      }

      return true;
    });

    return NextResponse.json({ tasks: filteredTasks, volunteerId });
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

    const taskRef = adminDb.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const task = (taskDoc.data() ?? {}) as Record<string, unknown>;
    const requestStatus = cleanString(task.requestStatus).toLowerCase();
    const action = cleanString(body.action).toLowerCase();
    const status = normalizeStatus(body.status);
    const caseId = cleanString(body.caseId ?? task.caseId);
    const requestId = cleanString(body.requestId ?? task.requestId);

    if (action === 'assign_ngo_candidate') {
      const ngoId = cleanString(body.ngoId ?? task.ngoId);
      const volunteerId = cleanString(body.assignedVolunteerId ?? body.volunteerId);

      if (!ngoId || !volunteerId) {
        return NextResponse.json({ error: 'ngoId and volunteerId are required.' }, { status: 400 });
      }

      await assignNgoCandidate(taskId, ngoId, volunteerId);
      await addSystemMessage(taskId, 'An NGO coordinator shortlisted a volunteer. The case will lock as soon as the volunteer accepts.');
      return NextResponse.json({ success: true, taskId, action: 'assign_ngo_candidate' });
    }

    if (action === 'archive' || action === 'delete') {
      const actorRole = cleanString(body.actorRole).toLowerCase();
      const actorId = cleanString(body.actorId);

      if (!actorRole || !actorId) {
        return NextResponse.json({ error: 'actorRole and actorId are required.' }, { status: 400 });
      }

      const isCompleted = ['completed', 'resolved'].includes(cleanString(task.status).toLowerCase());
      const isHandledExternally = cleanString(task.assignedSource).toLowerCase() === 'global';
      if (!isCompleted && !(actorRole === 'ngo' && isHandledExternally)) {
        return NextResponse.json({ error: 'Only completed or externally handled tasks can be deleted from dashboards.' }, { status: 409 });
      }

      if (actorRole === 'volunteer') {
        await taskRef.set(
          {
            hiddenFromVolunteerIds: FieldValue.arrayUnion(actorId),
            updatedAt: new Date().toISOString(),
            updatedAtServer: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return NextResponse.json({ success: true, taskId, action: 'archive', actorRole });
      }

      if (actorRole === 'ngo') {
        await taskRef.set(
          {
            hiddenFromNgoIds: FieldValue.arrayUnion(actorId),
            updatedAt: new Date().toISOString(),
            updatedAtServer: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return NextResponse.json({ success: true, taskId, action: 'archive', actorRole });
      }

      return NextResponse.json({ error: 'Unsupported actor role.' }, { status: 400 });
    }

    if (status === 'assigned' && cleanString(body.assignedVolunteerId)) {
      try {
        const result = await acceptRequestOwnership(
          taskId,
          cleanString(body.assignedVolunteerId),
          cleanString(body.assignedVolunteerName) || 'Volunteer'
        );
        await addSystemMessage(
          taskId,
          `${cleanString(body.assignedVolunteerName) || 'A volunteer'} accepted your request. Case chat is now open.`
        );

        return NextResponse.json({
          success: true,
          taskId,
          requestId: result.requestId,
          caseId: result.caseId,
          assignedSource: result.assignedSource,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Task assignment failed.';
        const statusCode = message === 'Task already assigned' ? 409 : 500;
        return NextResponse.json({ error: message }, { status: statusCode });
      }
    }

    if (requestStatus === 'accepted' && (status === 'pending' || status === 'open' || status === 'unassigned')) {
      return NextResponse.json({ error: 'Accepted tasks cannot return to pending.' }, { status: 409 });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    if ('status' in body) {
      patch.status = status;
    }
    if ('assignedVolunteerId' in body) {
      patch.assignedVolunteerId = body.assignedVolunteerId || null;
    }
    if ('assignedVolunteerName' in body) {
      patch.assignedVolunteerName = body.assignedVolunteerName || null;
    }
    if ('lastInterventionAt' in body) {
      patch.lastInterventionAt = body.lastInterventionAt || null;
    }

    const writes: Promise<unknown>[] = [taskRef.set(patch, { merge: true })];

    if (status === 'in_progress') {
      writes.push(addSystemMessage(taskId, 'The volunteer has started working on your case.'));
      if (caseId) {
        writes.push(adminDb.collection('cases').doc(caseId).set({ status: 'in_progress' }, { merge: true }));
      }
    }

    if (status === 'completed') {
      writes.push(addSystemMessage(taskId, 'This support request was marked complete.'));
      if (caseId) {
        writes.push(adminDb.collection('cases').doc(caseId).set({ status: 'completed' }, { merge: true }));
      }
      if (requestId) {
        writes.push(adminDb.collection('requests').doc(requestId).set({ status: 'accepted' }, { merge: true }));
      }
      if (cleanString(task.assignedVolunteerId)) {
        writes.push(
          adminDb.collection('users').doc(cleanString(task.assignedVolunteerId)).set(
            { availability: 'available', updatedAt: new Date().toISOString() },
            { merge: true }
          )
        );
      }
    }

    await Promise.all(writes);
    return NextResponse.json({ success: true, taskId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Task update failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
