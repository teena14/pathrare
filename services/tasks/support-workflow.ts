import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getAssociatedNgoIds, getNgoIdentifiers, hasNgoAssociation, normalizeAvailability } from '@/services/ngo/ngo-associations';

type FirestoreRecord = Record<string, unknown>;

export type SupportWorkflowInput = {
  taskId: string;
  caseId: string;
  requestId: string;
  userId: string;
  title: string | null;
  summary: string | null;
  description: string | null;
  type: string;
  category: string | null;
  needType: string;
  goal: string | null;
  resourceId: string | null;
  resourceName: string | null;
  diseaseCluster: string | null;
  urgencyScore: number;
  requiredSkills: string[];
  fallbackStrategy: string[];
  location: {
    country: string | null;
    state: string | null;
    city: string | null;
  };
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeRegion(region: { country?: unknown; state?: unknown; city?: unknown } | null | undefined) {
  return {
    country: asString(region?.country) || null,
    state: asString(region?.state) || null,
    city: asString(region?.city) || null,
  };
}

function getRegionKey(region: { country: string | null; state: string | null; city: string | null }) {
  return [region.country, region.state, region.city].filter(Boolean).map((part) => slugify(String(part))).join('__') || 'unknown_region';
}

function getDiseaseCluster(user: FirestoreRecord, providedCluster?: string | null) {
  return (
    asString(providedCluster) ||
    asString(user.confirmed_condition) ||
    asString(user.reported_condition) ||
    asString(user.primaryDisease) ||
    'rare_disease'
  );
}

function getNgoId(user: FirestoreRecord) {
  return getNgoIdentifiers(user).organizationId || getAssociatedNgoIds(user)[0] || null;
}

function getDisplayName(user: FirestoreRecord) {
  const firstName = asString(user.firstName);
  const lastName = asString(user.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || asString(user.displayName) || 'Patient';
}

function getCaseMetricDocId(caseDoc: FirestoreRecord) {
  const region = normalizeRegion(caseDoc.region as FirestoreRecord | undefined);
  const regionKey = getRegionKey(region);
  const diseaseCluster = slugify(asString(caseDoc.disease_cluster) || 'rare_disease');
  const needType = slugify(asString(caseDoc.need_type) || 'general');
  return `${regionKey}__${diseaseCluster}__${needType}`;
}

function getMetricContribution(caseDoc: FirestoreRecord) {
  const region = normalizeRegion(caseDoc.region as FirestoreRecord | undefined);
  const status = asString(caseDoc.status).toLowerCase();
  const urgency = Number(caseDoc.urgency_level ?? 0);
  return {
    docId: getCaseMetricDocId(caseDoc),
    payload: {
      region,
      disease_cluster: asString(caseDoc.disease_cluster) || 'rare_disease',
      need_type: asString(caseDoc.need_type) || 'general',
      total_cases: 1,
      urgent_cases: urgency >= 0.85 ? 1 : 0,
      unassigned_cases: status === 'unassigned' || status === 'pending' ? 1 : 0,
    },
  };
}

async function applyMetricDelta(tx: Transaction, caseDoc: FirestoreRecord, direction: 1 | -1) {
  const metric = getMetricContribution(caseDoc);
  const ref = adminDb.collection('region_metrics').doc(metric.docId);
  tx.set(
    ref,
    {
      region: metric.payload.region,
      disease_cluster: metric.payload.disease_cluster,
      need_type: metric.payload.need_type,
      total_cases: FieldValue.increment(metric.payload.total_cases * direction),
      urgent_cases: FieldValue.increment(metric.payload.urgent_cases * direction),
      unassigned_cases: FieldValue.increment(metric.payload.unassigned_cases * direction),
      last_updated: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function applyCaseMetricsTransition(tx: Transaction, previousCase: FirestoreRecord | null, nextCase: FirestoreRecord | null) {
  if (previousCase) {
    await applyMetricDelta(tx, previousCase, -1);
  }

  if (nextCase) {
    await applyMetricDelta(tx, nextCase, 1);
  }
}

export async function createSupportWorkflow(input: SupportWorkflowInput) {
  const userRef = adminDb.collection('users').doc(input.userId);
  const taskRef = adminDb.collection('tasks').doc(input.taskId);
  const caseRef = adminDb.collection('cases').doc(input.caseId);
  const requestRef = adminDb.collection('requests').doc(input.requestId);

  await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new Error('User profile not found.');
    }

    const user = (userSnap.data() ?? {}) as FirestoreRecord;
    const ngoId = getNgoId(user);
    const diseaseCluster = getDiseaseCluster(user, input.diseaseCluster);
    const region = normalizeRegion({
      country: input.location.country ?? user.country,
      state: input.location.state ?? user.state ?? user.region,
      city: input.location.city ?? user.location ?? user.city ?? user.district,
    });

    const caseDoc: FirestoreRecord = {
      user_id: input.userId,
      ngo_id: ngoId,
      volunteer_id: null,
      title: input.title,
      description: input.description ?? input.summary,
      disease_cluster: diseaseCluster,
      need_type: input.needType,
      urgency_level: input.urgencyScore,
      status: 'unassigned',
      assigned_source: null,
      region,
      created_at: new Date().toISOString(),
      resource_id: input.resourceId,
      resource_name: input.resourceName,
    };

    const requestDoc: FirestoreRecord = {
      case_id: input.caseId,
      volunteer_id: null,
      ngo_id: ngoId,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: null,
      assigned_source: null,
      visible_to_global: true,
      visible_to_ngo: Boolean(ngoId),
      candidate_volunteer_id: null,
      request_scope: ngoId ? 'global_and_ngo' : 'global_only',
    };

    const taskDoc: FirestoreRecord = {
      task_id: input.taskId,
      userId: input.userId,
      userName: getDisplayName(user),
      caseId: input.caseId,
      requestId: input.requestId,
      ngoId,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      goal: input.goal,
      type: input.type,
      category: input.category,
      needType: input.needType,
      title: input.title,
      summary: input.summary,
      description: input.description,
      urgency_score: input.urgencyScore,
      required_skills: input.requiredSkills,
      priority: input.urgencyScore >= 0.85 ? 'urgent' : input.urgencyScore >= 0.65 ? 'high' : 'medium',
      fallback_strategy: input.fallbackStrategy,
      status: 'open',
      requestStatus: 'pending',
      assignedVolunteerId: null,
      assignedVolunteerName: null,
      assignedSource: null,
      candidateVolunteerId: null,
      diseaseCluster,
      visibleToGlobal: true,
      visibleToNgo: Boolean(ngoId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceCollection: 'resources',
    };

    tx.set(caseRef, caseDoc, { merge: true });
    tx.set(requestRef, requestDoc, { merge: true });
    tx.set(taskRef, taskDoc, { merge: true });

    await applyCaseMetricsTransition(tx, null, caseDoc);
  });

  await taskRef.collection('messages').add({
    author: 'system',
    senderId: null,
    senderName: 'PathRare',
    body: 'Your volunteer support request has been created. Matching volunteers and NGOs can now review it.',
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });
}

export async function acceptRequestOwnership(taskId: string, volunteerId: string, volunteerName: string) {
  const taskRef = adminDb.collection('tasks').doc(taskId);

  return adminDb.runTransaction(async (tx) => {
    const taskSnap = await tx.get(taskRef);
    if (!taskSnap.exists) {
      throw new Error('Task not found.');
    }

    const task = (taskSnap.data() ?? {}) as FirestoreRecord;
    const requestId = asString(task.requestId);
    const caseId = asString(task.caseId);

    if (!requestId || !caseId) {
      throw new Error('Assignment workflow is incomplete for this task.');
    }

    const requestRef = adminDb.collection('requests').doc(requestId);
    const caseRef = adminDb.collection('cases').doc(caseId);
    const volunteerRef = adminDb.collection('users').doc(volunteerId);

    const [requestSnap, caseSnap, volunteerSnap] = await Promise.all([
      tx.get(requestRef),
      tx.get(caseRef),
      tx.get(volunteerRef),
    ]);

    if (!requestSnap.exists || !caseSnap.exists || !volunteerSnap.exists) {
      throw new Error('Task assignment prerequisites are missing.');
    }

    const request = (requestSnap.data() ?? {}) as FirestoreRecord;
    const currentCase = (caseSnap.data() ?? {}) as FirestoreRecord;
    const volunteer = (volunteerSnap.data() ?? {}) as FirestoreRecord;
    const requestNgoId = asString(request.ngo_id) || asString(task.ngoId);
    const volunteerNgoIds = getAssociatedNgoIds(volunteer);

    if (normalizeAvailability(volunteer.availability) !== 'available') {
      throw new Error('Volunteer is not available');
    }

    if (asString(request.status).toLowerCase() !== 'pending') {
      throw new Error('Task already assigned');
    }

    if (requestNgoId && !hasNgoAssociation(volunteer, requestNgoId)) {
      throw new Error('Volunteer is not linked to this NGO');
    }

    const volunteerTasksSnap = await tx.get(
      adminDb.collection('tasks').where('assignedVolunteerId', '==', volunteerId)
    );
    const hasActiveAssignment = volunteerTasksSnap.docs.some((doc) => {
      if (doc.id === taskId) {
        return false;
      }

      const existingTask = (doc.data() ?? {}) as FirestoreRecord;
      const status = asString(existingTask.status).toLowerCase();
      return ['assigned', 'active', 'in_progress'].includes(status);
    });

    if (hasActiveAssignment) {
      throw new Error('Volunteer already has an active task');
    }

    const assignedSource = requestNgoId && volunteerNgoIds.includes(requestNgoId) ? 'ngo' : 'global';

    const nextCase: FirestoreRecord = {
      ...currentCase,
      volunteer_id: volunteerId,
      status: 'assigned',
      assigned_source: assignedSource,
    };

    tx.set(
      requestRef,
      {
        status: 'accepted',
        volunteer_id: volunteerId,
        accepted_at: new Date().toISOString(),
        assigned_source: assignedSource,
        candidate_volunteer_id: null,
      },
      { merge: true }
    );

    tx.set(caseRef, nextCase, { merge: true });
    tx.set(
      taskRef,
      {
        status: 'assigned',
        requestStatus: 'accepted',
        assignedVolunteerId: volunteerId,
        assignedVolunteerName: volunteerName,
        assignedSource: assignedSource,
        candidateVolunteerId: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    tx.set(
      volunteerRef,
      {
        availability: 'busy',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await applyCaseMetricsTransition(tx, currentCase, nextCase);

    return {
      requestId,
      caseId,
      assignedSource,
    };
  });
}

export async function assignNgoCandidate(taskId: string, ngoId: string, volunteerId: string) {
  const taskRef = adminDb.collection('tasks').doc(taskId);

  return adminDb.runTransaction(async (tx) => {
    const taskSnap = await tx.get(taskRef);
    if (!taskSnap.exists) {
      throw new Error('Task not found.');
    }

    const task = (taskSnap.data() ?? {}) as FirestoreRecord;
    const requestId = asString(task.requestId);
    const caseId = asString(task.caseId);
    if (!requestId || !caseId) {
      throw new Error('Assignment workflow is incomplete for this task.');
    }

    const requestRef = adminDb.collection('requests').doc(requestId);
    const caseRef = adminDb.collection('cases').doc(caseId);
    const volunteerRef = adminDb.collection('users').doc(volunteerId);

    const [requestSnap, caseSnap, volunteerSnap] = await Promise.all([
      tx.get(requestRef),
      tx.get(caseRef),
      tx.get(volunteerRef),
    ]);

    if (!requestSnap.exists || !caseSnap.exists || !volunteerSnap.exists) {
      throw new Error('Unable to prepare NGO assignment.');
    }

    const request = (requestSnap.data() ?? {}) as FirestoreRecord;
    const currentCase = (caseSnap.data() ?? {}) as FirestoreRecord;
    const volunteer = (volunteerSnap.data() ?? {}) as FirestoreRecord;

    if (asString(request.status).toLowerCase() !== 'pending') {
      throw new Error('Task already assigned');
    }

    if (!hasNgoAssociation(volunteer, ngoId)) {
      throw new Error('Volunteer is not linked to this NGO.');
    }

    tx.set(
      requestRef,
      {
        ngo_id: ngoId,
        candidate_volunteer_id: volunteerId,
        candidate_assignment_at: new Date().toISOString(),
        status: 'pending',
      },
      { merge: true }
    );

    tx.set(
      caseRef,
      {
        ...currentCase,
        ngo_id: ngoId,
      },
      { merge: true }
    );

    tx.set(
      taskRef,
      {
        ngoId,
        candidateVolunteerId: volunteerId,
        status: 'pending',
        requestStatus: 'pending',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { requestId, caseId };
  });
}

export function computeNgoPriorityScore(metric: FirestoreRecord) {
  return (
    0.5 * Number(metric.total_cases ?? 0) +
    1.5 * Number(metric.urgent_cases ?? 0) +
    1.0 * Number(metric.unassigned_cases ?? 0)
  );
}
