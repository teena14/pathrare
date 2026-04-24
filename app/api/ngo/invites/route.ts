import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAssociatedNgoIds } from '@/lib/ngo-associations';

export const dynamic = 'force-dynamic';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return asString(value).toLowerCase();
}

function serialize(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return { id: doc.id, ...(doc.data() ?? {}) };
}

export async function GET(req: NextRequest) {
  try {
    const email = normalizeEmail(req.nextUrl.searchParams.get('email'));
    const ngoId = asString(req.nextUrl.searchParams.get('ngoId'));

    let query: FirebaseFirestore.Query = adminDb.collection('ngo_invites');

    if (email) {
      query = query.where('email', '==', email);
    }

    if (ngoId) {
      query = query.where('ngo_id', '==', ngoId);
    }

    const snap = await query.get();
    const invites = snap.docs
      .map((doc) => serialize(doc) as Record<string, unknown>)
      .sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));

    return NextResponse.json({ invites });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load NGO invites.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ngoId = asString(body.ngoId);
    const email = normalizeEmail(body.email);

    if (!ngoId || !email) {
      return NextResponse.json({ error: 'ngoId and email are required.' }, { status: 400 });
    }

    const pendingInviteSnap = await adminDb
      .collection('ngo_invites')
      .where('ngo_id', '==', ngoId)
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingInviteSnap.empty) {
      return NextResponse.json({ error: 'A pending invite already exists for this email.' }, { status: 409 });
    }

    const volunteerSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (!volunteerSnap.empty) {
      const volunteer = (volunteerSnap.docs[0].data() ?? {}) as Record<string, unknown>;
      if (getAssociatedNgoIds(volunteer).includes(ngoId)) {
        return NextResponse.json({ error: 'Volunteer is already linked to this NGO.' }, { status: 409 });
      }
    }

    const ref = adminDb.collection('ngo_invites').doc();
    const invite = {
      ngo_id: ngoId,
      email,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await ref.set(invite);
    return NextResponse.json({ success: true, invite: { id: ref.id, ...invite } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create NGO invite.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const inviteId = asString(body.inviteId);
    const action = asString(body.action).toLowerCase();
    const volunteerId = asString(body.volunteerId);

    if (!inviteId || !action) {
      return NextResponse.json({ error: 'inviteId and action are required.' }, { status: 400 });
    }

    const inviteRef = adminDb.collection('ngo_invites').doc(inviteId);

    if (action === 'reject') {
      await inviteRef.set(
        {
          status: 'rejected',
          updated_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({ success: true, inviteId, action });
    }

    if (action !== 'accept') {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    if (!volunteerId) {
      return NextResponse.json({ error: 'volunteerId is required to accept an invite.' }, { status: 400 });
    }

    await adminDb.runTransaction(async (tx) => {
      const [inviteSnap, volunteerSnap] = await Promise.all([
        tx.get(inviteRef),
        tx.get(adminDb.collection('users').doc(volunteerId)),
      ]);

      if (!inviteSnap.exists) {
        throw new Error('Invite not found.');
      }

      if (!volunteerSnap.exists) {
        throw new Error('Volunteer not found.');
      }

      const invite = (inviteSnap.data() ?? {}) as Record<string, unknown>;
      if (asString(invite.status).toLowerCase() !== 'pending') {
        throw new Error('Invite is no longer pending.');
      }

      tx.set(
        adminDb.collection('users').doc(volunteerId),
        {
          associated_ngo_ids: FieldValue.arrayUnion(asString(invite.ngo_id)),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      tx.set(
        inviteRef,
        {
          status: 'accepted',
          volunteer_id: volunteerId,
          updated_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, inviteId, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update NGO invite.';
    const status = message.includes('pending') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
