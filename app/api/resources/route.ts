import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  asString,
  asStringArray,
  getNgoSpecializationSummary,
  getNgoSpecializationTags,
  matchNgoToPatient,
  normalizeToken,
} from '@/lib/ngo-support';

export const dynamic = 'force-dynamic';

type ResourceRecord = Record<string, unknown>;
type UserRecord = Record<string, unknown>;

const CATEGORY_TO_GOAL: Record<string, string> = {
  financial: 'financial_legal',
  education: 'adaptive_education',
  medical: 'medical_care',
  assistive: 'assistive_support',
};

function getUserCountry(user: UserRecord) {
  const location = (user.location as Record<string, unknown> | undefined) ?? {};
  return asString(location.country) || asString(user.country) || 'India';
}

function getDiseaseTokens(user: UserRecord) {
  const tokens = new Set<string>(['rare_disease']);
  const values = [
    asString(user.confirmed_condition),
    asString(user.reported_condition),
    asString(user.primaryDisease),
  ].filter(Boolean);

  values.forEach((value) => {
    const token = normalizeToken(value);
    if (token) tokens.add(token);
  });

  return tokens;
}

function getEligibilityTokens(user: UserRecord) {
  const tokens = new Set<string>();
  const status = asString(user.condition_status || user.diagnosisStatus).toLowerCase();

  if (status) {
    tokens.add('health_condition');
  }

  if (status === 'diagnosed' || status === 'suspected' || asString(user.reported_condition || user.primaryDisease)) {
    tokens.add('rare_disease');
    tokens.add('disability');
  }

  if (String(user.lowIncome ?? '').toLowerCase() === 'true' || String(user.financialNeed ?? '').toLowerCase() === 'true') {
    tokens.add('low_income');
  }

  return tokens;
}

function appliesToUser(resource: ResourceRecord, user: UserRecord) {
  const reasons: string[] = [];
  const resourceLocation = (resource.location as Record<string, unknown> | undefined) ?? {};
  const resourceCountry = asString(resourceLocation.country);
  const isGlobal = Boolean(resource.is_global);
  const userCountry = getUserCountry(user);

  if (isGlobal || !resourceCountry || resourceCountry.toLowerCase() === userCountry.toLowerCase()) {
    reasons.push(isGlobal ? 'Available globally' : `Available in ${userCountry}`);
  } else {
    return { applicable: false, reasons: [] };
  }

  const diseaseTags = asStringArray(resource.disease_tags).map(normalizeToken);
  const diseaseTokens = getDiseaseTokens(user);
  if (
    diseaseTags.length === 0 ||
    diseaseTags.includes('rare_disease') ||
    diseaseTags.includes('general') ||
    diseaseTags.some((tag) => diseaseTokens.has(tag))
  ) {
    reasons.push(
      diseaseTags.some((tag) => diseaseTokens.has(tag) && tag !== 'rare_disease')
        ? 'Matches your reported condition'
        : 'Suitable for rare disease support needs'
    );
  } else {
    return { applicable: false, reasons: [] };
  }

  const eligibilityTags = asStringArray(resource.eligibility_tags).map(normalizeToken);
  const eligibilityTokens = getEligibilityTokens(user);
  if (eligibilityTags.length === 0 || eligibilityTags.some((tag) => eligibilityTokens.has(tag))) {
    if (eligibilityTags.length > 0) reasons.push('Matches your likely eligibility profile');
  } else {
    return { applicable: false, reasons: [] };
  }

  return { applicable: true, reasons };
}

function buildNgoResource(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  ngo: UserRecord,
  user: UserRecord,
  goal: string,
  existingConnection: Record<string, unknown> | null
) {
  const match = matchNgoToPatient(ngo, user);
  if (!match.applicable) {
    return null;
  }

  const specializationSummary = getNgoSpecializationSummary(ngo);
  const specializationTags = getNgoSpecializationTags(ngo);
  const region = asString(ngo.region) || null;
  const organizationId = asString(ngo.organization_id) || doc.id;
  const ngoName = asString(ngo.orgName) || asString(ngo.displayName) || 'NGO Partner';

  return {
    id: `ngo-${doc.id}`,
    name: ngoName,
    type: 'ngo_partner',
    goal,
    description:
      specializationSummary ||
      `${ngoName} is available on PathRare for direct NGO support coordination.`,
    support_type: specializationTags.length ? specializationTags : ['Medical Support'],
    location: {
      country: asString(ngo.country) || 'India',
      state: region,
      city: null,
    },
    trust_level: 'in_portal',
    source: 'pathrare_ngo',
    contact_url: '',
    priority_score: Math.min(10, 6 + match.score),
    applicability_reasons: match.reasons,
    applicable: true,
    resource_kind: 'ngo',
    ngoUserId: doc.id,
    organizationId,
    organizationName: ngoName,
    specialization_summary: specializationSummary,
    specialization_tags: specializationTags,
    connection_status: asString(existingConnection?.status) || null,
    connection_request_id: asString(existingConnection?.id) || null,
    direct_connect: true,
  };
}

export async function GET(req: NextRequest) {
  try {
    const category = asString(req.nextUrl.searchParams.get('category'));
    const userId = asString(req.nextUrl.searchParams.get('userId'));
    const goal = CATEGORY_TO_GOAL[category];

    if (!goal) {
      return NextResponse.json({ error: 'A valid category is required.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const [userDoc, resourcesSnap, ngoUsersSnap, connectionsSnap] = await Promise.all([
      adminDb.collection('users').doc(userId).get(),
      adminDb.collection('resources').where('goal', '==', goal).get(),
      category === 'medical' ? adminDb.collection('users').where('role', '==', 'ngo').get() : Promise.resolve(null),
      category === 'medical'
        ? adminDb.collection('ngo_patient_connections').where('patient_id', '==', userId).get()
        : Promise.resolve(null),
    ]);

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const user = userDoc.data() as UserRecord;
    const resources = resourcesSnap.docs
      .map((doc) => {
        const data = doc.data() as ResourceRecord;
        const match = appliesToUser(data, user);
        return {
          id: doc.id,
          ...data,
          resource_kind: 'resource',
          applicability_reasons: match.reasons,
          applicable: match.applicable,
        };
      })
      .filter((resource) => resource.applicable);

    const connectionByNgoId = new Map(
      (connectionsSnap?.docs ?? []).map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>;
        return [asString(data.ngo_id), { id: doc.id, ...data }];
      })
    );

    const ngoResources =
      category === 'medical'
        ? (ngoUsersSnap?.docs ?? [])
            .map((doc) => {
              const data = (doc.data() ?? {}) as UserRecord;
              const organizationId = asString(data.organization_id) || doc.id;
              return buildNgoResource(doc, data, user, goal, connectionByNgoId.get(organizationId) ?? null);
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        : [];

    const combinedResources = [...resources, ...ngoResources].sort(
      (a, b) =>
        Number((b as Record<string, unknown>).priority_score ?? 0) -
        Number((a as Record<string, unknown>).priority_score ?? 0)
    );

    return NextResponse.json({ resources: combinedResources, category, goal, userId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load resources.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
