import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getAssociatedNgoIds } from '@/services/ngo/ngo-associations';

export const dynamic = 'force-dynamic';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function serialize(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return { id: doc.id, ...(doc.data() ?? {}) };
}

export async function GET(req: NextRequest) {
  try {
    const ngoId = asString(req.nextUrl.searchParams.get('ngoId'));
    const volunteerId = asString(req.nextUrl.searchParams.get('volunteerId'));

    let query: FirebaseFirestore.Query = adminDb.collection('ngo_join_requests');

    if (ngoId) {
      query = query.where('ngo_id', '==', ngoId);
    }

    if (volunteerId) {
      query = query.where('volunteer_id', '==', volunteerId);
    }

    const snap = await query.get();
    const joinRequests = snap.docs
      .map((doc) => serialize(doc) as Record<string, unknown>)
      .sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));

    return NextResponse.json({ joinRequests });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load join requests.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ngoId = asString(body.ngoId);
    const volunteerId = asString(body.volunteerId);

    if (!ngoId || !volunteerId) {
      return NextResponse.json({ error: 'ngoId and volunteerId are required.' }, { status: 400 });
    }

    const volunteerRef = adminDb.collection('users').doc(volunteerId);
    const volunteerSnap = await volunteerRef.get();
    if (!volunteerSnap.exists) {
      return NextResponse.json({ error: 'Volunteer not found.' }, { status: 404 });
    }

    if (getAssociatedNgoIds((volunteerSnap.data() ?? {}) as Record<string, unknown>).includes(ngoId)) {
      return NextResponse.json({ error: 'Volunteer is already linked to this NGO.' }, { status: 409 });
    }

    const existingPending = await adminDb
      .collection('ngo_join_requests')
      .where('ngo_id', '==', ngoId)
      .where('volunteer_id', '==', volunteerId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingPending.empty) {
      return NextResponse.json({ error: 'A pending join request already exists.' }, { status: 409 });
    }

    const ref = adminDb.collection('ngo_join_requests').doc();
    const joinRequest = {
      ngo_id: ngoId,
      volunteer_id: volunteerId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await ref.set(joinRequest);
    return NextResponse.json({ success: true, joinRequest: { id: ref.id, ...joinRequest } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create join request.';
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

    const requestRef = adminDb.collection('ngo_join_requests').doc(requestId);

    if (action === 'reject') {
      await requestRef.set(
        {
          status: 'rejected',
          updated_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({ success: true, requestId, action });
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    await adminDb.runTransaction(async (tx) => {
      const requestSnap = await tx.get(requestRef);

      if (!requestSnap.exists) {
        throw new Error('Join request not found.');
      }

      const joinRequest = (requestSnap.data() ?? {}) as Record<string, unknown>;
      if (asString(joinRequest.status).toLowerCase() !== 'pending') {
        throw new Error('Join request is no longer pending.');
      }

      const volunteerRef = adminDb.collection('users').doc(asString(joinRequest.volunteer_id));
      const volunteerSnap = await tx.get(volunteerRef);

      if (!volunteerSnap.exists) {
        throw new Error('Volunteer not found.');
      }

      tx.set(
        volunteerRef,
        {
          associated_ngo_ids: FieldValue.arrayUnion(asString(joinRequest.ngo_id)),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      tx.set(
        requestRef,
        {
          status: 'approved',
          updated_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, requestId, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update join request.';
    const status = message.includes('pending') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
