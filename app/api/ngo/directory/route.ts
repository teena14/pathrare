import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';
import { getNgoIdentifiers } from '@/services/ngo/ngo-associations';

export const dynamic = 'force-dynamic';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  try {
    const snap = await adminDb.collection('users').where('role', '==', 'ngo').get();
    const ngos = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>;
        const identifiers = getNgoIdentifiers({ uid: doc.id, ...data });

        return {
          id: doc.id,
          organizationId: identifiers.organizationId || doc.id,
          name: identifiers.orgName,
          region: asString(data.region) || null,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({ ngos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load NGO directory.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
