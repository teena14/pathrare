import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { computeNgoPriorityScore } from '@/lib/support-workflow';
import { getAssociatedNgoIds, getNgoIdentifiers, hasNgoAssociation, normalizeAvailability } from '@/lib/ngo-associations';

export const dynamic = 'force-dynamic';

type FirestoreRecord = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
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
    Object.entries(value as FirestoreRecord).map(([key, entry]) => [key, serializeValue(entry)])
  );
}

function serializeDoc(doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot) {
  return {
    id: doc.id,
    ...(serializeValue(doc.data() ?? {}) as FirestoreRecord),
  };
}

function isVisibleToNgo(request: FirestoreRecord, organizationId: string | null) {
  return Boolean(organizationId) && asString(request.ngo_id) === organizationId;
}

function matchesNgoVolunteer(volunteer: FirestoreRecord, organizationId: string | null, orgName: string) {
  if (organizationId && hasNgoAssociation(volunteer, organizationId)) {
    return true;
  }

  const volunteerOrgName = asString(volunteer.orgName);
  return Boolean(orgName && volunteerOrgName && volunteerOrgName.toLowerCase() === orgName.toLowerCase());
}

function getPatientRegion(user: FirestoreRecord) {
  const location = (user.location && typeof user.location === 'object' ? user.location : null) as FirestoreRecord | null;
  return {
    country: asString(location?.country) || asString(user.country) || null,
    state: asString(location?.state) || asString(user.state) || asString(user.region) || null,
    city: asString(location?.city) || asString(user.city) || asString(user.location) || null,
  };
}

function groupByRegion(metrics: Array<FirestoreRecord>) {
  const grouped = new Map<string, FirestoreRecord>();

  metrics.forEach((metric) => {
    const region = (metric.region as FirestoreRecord | undefined) ?? {};
    const key = JSON.stringify({
      country: asString(region.country),
      state: asString(region.state),
      city: asString(region.city),
    });
    const existing = grouped.get(key) ?? {
      region: {
        country: asString(region.country) || null,
        state: asString(region.state) || null,
        city: asString(region.city) || null,
      },
      total_cases: 0,
      urgent_cases: 0,
      unassigned_cases: 0,
      disease_clusters: [] as string[],
      need_types: [] as string[],
    };

    existing.total_cases = Number(existing.total_cases ?? 0) + Number(metric.total_cases ?? 0);
    existing.urgent_cases = Number(existing.urgent_cases ?? 0) + Number(metric.urgent_cases ?? 0);
    existing.unassigned_cases = Number(existing.unassigned_cases ?? 0) + Number(metric.unassigned_cases ?? 0);
    existing.disease_clusters = Array.from(
      new Set([...(existing.disease_clusters as string[]), asString(metric.disease_cluster)].filter(Boolean))
    );
    existing.need_types = Array.from(
      new Set([...(existing.need_types as string[]), asString(metric.need_type)].filter(Boolean))
    );

    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).map((metric, index) => ({
    id: `metric-${index}`,
    ...metric,
    priority_score: computeNgoPriorityScore(metric),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const ngoUserId = req.nextUrl.searchParams.get('ngoId');
    const diseaseType = asString(req.nextUrl.searchParams.get('diseaseType'));
    const needType = asString(req.nextUrl.searchParams.get('needType'));

    if (!ngoUserId) {
      return NextResponse.json({ error: 'ngoId is required.' }, { status: 400 });
    }

    const ngoUserSnap = await adminDb.collection('users').doc(ngoUserId).get();
    if (!ngoUserSnap.exists) {
      return NextResponse.json({ error: 'NGO user not found.' }, { status: 404 });
    }

    const ngoUser = serializeDoc(ngoUserSnap) as FirestoreRecord;
    const { organizationId, orgName } = getNgoIdentifiers(ngoUser);
    const focusTags = asStringArray(ngoUser.focus_tags).length
      ? asStringArray(ngoUser.focus_tags)
      : asStringArray(ngoUser.focusAreas);

    const [
      volunteersSnap,
      requestsSnap,
      casesSnap,
      tasksSnap,
      regionMetricsSnap,
    ] = await Promise.all([
      adminDb.collection('users').where('role', '==', 'volunteer').get(),
      adminDb.collection('requests').get(),
      adminDb.collection('cases').get(),
      adminDb.collection('tasks').get(),
      adminDb.collection('region_metrics').get(),
    ]);

    const allVolunteers: FirestoreRecord[] = volunteersSnap.docs
      .map((doc) => serializeDoc(doc) as FirestoreRecord)
      .map((volunteer) => ({ ...volunteer, associated_ngo_ids: getAssociatedNgoIds(volunteer) }));
    const volunteers = allVolunteers
      .filter((volunteer) => matchesNgoVolunteer(volunteer as FirestoreRecord, organizationId, orgName));

    const requests = requestsSnap.docs.map((doc) => serializeDoc(doc) as FirestoreRecord);
    const cases = casesSnap.docs.map((doc) => serializeDoc(doc) as FirestoreRecord);
    const tasks = tasksSnap.docs.map((doc) => serializeDoc(doc) as FirestoreRecord);
    const taskByRequestId = new Map(tasks.map((task) => [asString(task.requestId), task]));
    const taskByCaseId = new Map(tasks.map((task) => [asString(task.caseId), task]));
    const caseById = new Map(cases.map((entry) => [asString(entry.id), entry]));
    const volunteerIds = new Set(volunteers.map((volunteer) => asString(volunteer.id)));
    const volunteerById = new Map(allVolunteers.map((volunteer) => [asString(volunteer.id), volunteer]));
    const isHiddenFromNgo = (task: FirestoreRecord | null) =>
      Boolean(organizationId) && asStringArray(task?.hiddenFromNgoIds).includes(String(organizationId));
    const visibleRequests = requests.filter((request) => {
      if (asString(request.status).toLowerCase() !== 'pending') {
        return false;
      }

      return isVisibleToNgo(request, organizationId);
    });
    const incomingCaseIds = new Set(visibleRequests.map((request) => asString(request.case_id)).filter(Boolean));
    const patientIds = Array.from(
      new Set(
        cases
          .filter((entry) => {
            const caseNgoId = asString(entry.ngo_id);
            return incomingCaseIds.has(asString(entry.id)) || (organizationId ? caseNgoId === organizationId : false);
          })
          .map((entry) => asString(entry.user_id))
          .filter(Boolean)
      )
    );
    const patientSnaps = await Promise.all(patientIds.map((id) => adminDb.collection('users').doc(id).get()));
    const patientById = new Map(
      patientSnaps.filter((doc) => doc.exists).map((doc) => {
        const data = serializeDoc(doc) as FirestoreRecord;
        return [asString(data.id), data];
      })
    );

    const incomingRequests = visibleRequests
      .map((request) => {
        const task = taskByRequestId.get(asString(request.id)) ?? null;
        if (isHiddenFromNgo(task)) {
          return null;
        }
        const caseDoc = caseById.get(asString(request.case_id)) ?? null;
        const patient = patientById.get(asString(caseDoc?.user_id)) ?? null;
        const region = (caseDoc?.region && typeof caseDoc.region === 'object' ? caseDoc.region : getPatientRegion(patient ?? {})) as FirestoreRecord;

        return {
          id: asString(task?.id) || asString(request.id),
          requestId: asString(request.id),
          caseId: asString(request.case_id),
          userId: asString(caseDoc?.user_id),
          title: asString(task?.title) || asString(caseDoc?.title) || 'Support request',
          summary: asString(task?.summary) || asString(caseDoc?.description),
          category: asString(task?.category) || null,
          needType: asString(task?.needType) || asString(caseDoc?.need_type) || 'medical',
          urgencyScore: Number(task?.urgency_score ?? caseDoc?.urgency_level ?? 0.5),
          status: asString(task?.status) || 'pending',
          requestStatus: asString(request.status) || 'pending',
          district: asString(region.city) || 'Location not added',
          region: asString(region.state) || asString(region.country) || 'Region not added',
          diseaseCluster: asString(caseDoc?.disease_cluster) || asString(task?.diseaseCluster) || 'rare_disease',
          patientName: asString(patient?.displayName) || `${asString(patient?.firstName)} ${asString(patient?.lastName)}`.trim() || 'Patient',
          patientLocation: region,
          assignedVolunteerId: asString(task?.assignedVolunteerId) || asString(request.volunteer_id) || null,
          candidateVolunteerId: asString(task?.candidateVolunteerId) || asString(request.candidate_volunteer_id) || null,
          assignedSource: asString(caseDoc?.assigned_source) || asString(task?.assignedSource) || null,
          createdAt: asString(task?.createdAt) || asString(request.created_at) || asString(caseDoc?.created_at),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const activeCases = cases
      .filter((entry) => {
        if (!organizationId) return false;
        if (asString(entry.ngo_id) !== organizationId) return false;
        const assignedVolunteerId = asString(entry.volunteer_id) || asString(taskByCaseId.get(asString(entry.id))?.assignedVolunteerId);
        if (!assignedVolunteerId) return false;
        return hasNgoAssociation(volunteerById.get(assignedVolunteerId) ?? null, organizationId);
      })
      .map((entry) => {
        const task = taskByCaseId.get(asString(entry.id)) ?? null;
        if (isHiddenFromNgo(task)) {
          return null;
        }
        const patient = patientById.get(asString(entry.user_id)) ?? null;
        const region = (entry.region as FirestoreRecord | undefined) ?? getPatientRegion(patient ?? {});

        return {
          id: asString(task?.id) || asString(entry.id),
          taskId: asString(task?.id),
          caseId: asString(entry.id),
          title: asString(task?.title) || asString(entry.title) || 'Support request',
          needType: asString(task?.needType) || asString(entry.need_type) || 'medical',
          diseaseCluster: asString(entry.disease_cluster) || 'rare_disease',
          urgencyScore: Number(task?.urgency_score ?? entry.urgency_level ?? 0.5),
          status: asString(task?.status) || asString(entry.status) || 'assigned',
          patientName: asString(patient?.displayName) || `${asString(patient?.firstName)} ${asString(patient?.lastName)}`.trim() || 'Patient',
          district: asString(region.city) || 'Location not added',
          region: asString(region.state) || asString(region.country) || 'Region not added',
          assignedVolunteerId: asString(entry.volunteer_id) || asString(task?.assignedVolunteerId) || null,
          assignedVolunteerName: asString(task?.assignedVolunteerName) || null,
          createdAt: asString(entry.created_at) || asString(task?.createdAt),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const externalCases = cases
      .filter((entry) => {
        if (!organizationId) return false;
        if (asString(entry.ngo_id) !== organizationId) return false;
        const assignedVolunteerId = asString(entry.volunteer_id) || asString(taskByCaseId.get(asString(entry.id))?.assignedVolunteerId);
        if (!assignedVolunteerId) return false;
        return !hasNgoAssociation(volunteerById.get(assignedVolunteerId) ?? null, organizationId);
      })
      .map((entry) => {
        const task = taskByCaseId.get(asString(entry.id)) ?? null;
        if (isHiddenFromNgo(task)) {
          return null;
        }
        return {
          id: asString(task?.id) || asString(entry.id),
          taskId: asString(task?.id),
          caseId: asString(entry.id),
          title: asString(task?.title) || asString(entry.title) || 'Support request',
          assignedVolunteerId: asString(entry.volunteer_id) || asString(task?.assignedVolunteerId) || null,
          assignedVolunteerName: asString(task?.assignedVolunteerName) || null,
          status: asString(task?.status) || asString(entry.status) || 'assigned',
          needType: asString(task?.needType) || asString(entry.need_type) || 'medical',
          diseaseCluster: asString(entry.disease_cluster) || 'rare_disease',
          createdAt: asString(entry.created_at) || asString(task?.createdAt),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const filteredRegionMetrics = regionMetricsSnap.docs
      .map((doc) => serializeDoc(doc) as FirestoreRecord)
      .filter((metric) => {
        const metricDisease = asString(metric.disease_cluster);
        const metricNeed = asString(metric.need_type);
        const diseaseMatches = !focusTags.length || focusTags.some((tag) => tag.toLowerCase() === metricDisease.toLowerCase());
        const diseaseFilterMatches = !diseaseType || diseaseType.toLowerCase() === metricDisease.toLowerCase();
        const needFilterMatches = !needType || needType.toLowerCase() === metricNeed.toLowerCase();
        return diseaseMatches && diseaseFilterMatches && needFilterMatches;
      });

    const heatmap = groupByRegion(filteredRegionMetrics as FirestoreRecord[])
      .sort((a, b) => Number(b.priority_score) - Number(a.priority_score))
      .map((metric) => ({
        ...metric,
        color:
          Number(metric.priority_score) >= 15
            ? 'red'
            : Number(metric.priority_score) >= 10
              ? 'orange'
              : Number(metric.priority_score) >= 5
                ? 'yellow'
                : 'green',
      }));

    return NextResponse.json({
      ngo: {
        id: asString(ngoUser.id),
        organizationId,
        name: orgName,
        region: asString(ngoUser.region) || null,
        focusTags,
      },
      volunteers,
      incomingRequests,
      activeCases,
      externalCases,
      heatmap,
      summary: {
        incomingRequests: incomingRequests.length,
        activeCases: activeCases.length,
        externalCases: externalCases.length,
        availableVolunteers: volunteers.filter((volunteer) => normalizeAvailability(volunteer.availability) === 'available').length,
        linkedVolunteers: volunteerIds.size,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load NGO dashboard data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
