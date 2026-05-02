import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getAssociatedNgoIds } from '@/services/ngo/ngo-associations';

export const dynamic = 'force-dynamic';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const volunteerId = asString(body.volunteerId);
    const ngoId = asString(body.ngoId);
    const action = asString(body.action).toLowerCase();

    if (!volunteerId || !ngoId || !action) {
      return NextResponse.json({ error: 'volunteerId, ngoId, and action are required.' }, { status: 400 });
    }

    if (action !== 'leave' && action !== 'remove') {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    const volunteerRef = adminDb.collection('users').doc(volunteerId);
    await adminDb.runTransaction(async (tx) => {
      const volunteerSnap = await tx.get(volunteerRef);
      if (!volunteerSnap.exists) {
        throw new Error('Volunteer not found.');
      }

      const volunteer = (volunteerSnap.data() ?? {}) as Record<string, unknown>;
      const nextNgoIds = getAssociatedNgoIds(volunteer).filter((id) => id !== ngoId);

      tx.set(
        volunteerRef,
        {
          associated_ngo_ids: nextNgoIds,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, volunteerId, ngoId, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update NGO association.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
