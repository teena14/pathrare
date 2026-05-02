import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getNgoIdentifiers } from '@/services/ngo/ngo-associations';
import {
  asString,
  buildPatientConnectionSummary,
  getClinicalProfileLink,
  getPatientDisplayName,
  getPatientRegionLabel,
} from '@/services/ngo/ngo-support';

export const dynamic = 'force-dynamic';

type FirestoreRecord = Record<string, unknown>;

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

function serializeDoc(doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot): { id: string } & FirestoreRecord {
  return {
    id: doc.id,
    ...(serializeValue(doc.data() ?? {}) as FirestoreRecord),
  };
}

export async function GET(req: NextRequest) {
  try {
    const patientId = asString(req.nextUrl.searchParams.get('patientId'));
    const ngoId = asString(req.nextUrl.searchParams.get('ngoId'));

    if (!patientId && !ngoId) {
      return NextResponse.json({ error: 'patientId or ngoId is required.' }, { status: 400 });
    }

    let query: FirebaseFirestore.Query = adminDb.collection('ngo_patient_connections');

    if (patientId) {
      query = query.where('patient_id', '==', patientId);
    }

    if (ngoId) {
      const ngoSnap = await adminDb.collection('users').doc(ngoId).get();
      if (!ngoSnap.exists) {
        return NextResponse.json({ error: 'NGO user not found.' }, { status: 404 });
      }

      const identifiers = getNgoIdentifiers({ uid: ngoSnap.id, ...((ngoSnap.data() ?? {}) as FirestoreRecord) });
      if (!identifiers.organizationId) {
        return NextResponse.json({ error: 'NGO organization id not found.' }, { status: 404 });
      }

      query = query.where('ngo_id', '==', identifiers.organizationId);
    }

    const snap = await query.get();
    const requests = snap.docs
      .map((doc) => serializeDoc(doc) as any)
      .sort((left, right) => String(right.updated_at ?? right.created_at ?? '').localeCompare(String(left.updated_at ?? left.created_at ?? '')));

    return NextResponse.json({ requests, patientId: patientId || null, ngoId: ngoId || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load NGO connections.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = asString(body.patientId);
    const ngoId = asString(body.ngoId);

    if (!patientId || !ngoId) {
      return NextResponse.json({ error: 'patientId and ngoId are required.' }, { status: 400 });
    }

    const [patientSnap, ngoSnap] = await Promise.all([
      adminDb.collection('users').doc(patientId).get(),
      adminDb.collection('users').doc(ngoId).get(),
    ]);

    if (!patientSnap.exists) {
      return NextResponse.json({ error: 'Patient profile not found.' }, { status: 404 });
    }

    if (!ngoSnap.exists) {
      return NextResponse.json({ error: 'NGO profile not found.' }, { status: 404 });
    }

    const patient = (patientSnap.data() ?? {}) as FirestoreRecord;
    const ngo = (ngoSnap.data() ?? {}) as FirestoreRecord;
    const identifiers = getNgoIdentifiers({ uid: ngoSnap.id, ...ngo });

    if (!identifiers.organizationId) {
      return NextResponse.json({ error: 'NGO organization id not found.' }, { status: 404 });
    }

    const requestId = `${identifiers.organizationId}__${patientId}`;
    const requestRef = adminDb.collection('ngo_patient_connections').doc(requestId);
    const existingSnap = await requestRef.get();
    const createdAt = existingSnap.exists
      ? asString((existingSnap.data() ?? {}).created_at) || new Date().toISOString()
      : new Date().toISOString();

    const clinicalProfileUrl = getClinicalProfileLink(patientId, patient);
    const payload = {
      patient_id: patientId,
      patient_name: getPatientDisplayName(patient),
      patient_email: asString(patient.email) || null,
      patient_location: getPatientRegionLabel(patient),
      patient_condition:
        asString(patient.primaryDisease) ||
        asString(patient.confirmed_condition) ||
        asString(patient.reported_condition) ||
        null,
      diagnosis_status: asString(patient.diagnosisStatus) || null,
      caregiver_name: asString(patient.caregiverName) || null,
      patient_summary: buildPatientConnectionSummary(patient),
      ngo_id: identifiers.organizationId,
      ngo_name: identifiers.orgName,
      status: 'pending',
      source: 'life_assist_medical',
      clinical_profile_url: clinicalProfileUrl,
      clinical_profile_available: Boolean(clinicalProfileUrl),
      created_at: createdAt,
      updated_at: new Date().toISOString(),
    };

    await requestRef.set(payload, { merge: true });

    return NextResponse.json(
      {
        success: true,
        reused: existingSnap.exists,
        request: {
          id: requestId,
          ...payload,
        },
      },
      { status: existingSnap.exists ? 200 : 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create NGO connection request.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = asString(body.requestId);
    const action = asString(body.action).toLowerCase();

    if (!requestId || !action) {
      return NextResponse.json({ error: 'requestId and action are required.' }, { status: 400 });
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    const requestRef = adminDb.collection('ngo_patient_connections').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return NextResponse.json({ error: 'Connection request not found.' }, { status: 404 });
    }

    const current = (requestSnap.data() ?? {}) as FirestoreRecord;
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';

    await requestRef.set(
      {
        status: nextStatus,
        updated_at: new Date().toISOString(),
        accepted_at: action === 'accept' ? new Date().toISOString() : (current.accepted_at ?? null),
        declined_at: action === 'decline' ? new Date().toISOString() : null,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      requestId,
      action,
      status: nextStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update NGO connection request.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
