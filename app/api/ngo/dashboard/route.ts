import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

type FirestoreRecord = Record<string, unknown>;

function serializeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  return Object.fromEntries(
    Object.entries(value as FirestoreRecord).map(([key, entry]) => [key, serializeValue(entry)])
  );
}

function serializeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  return {
    id: doc.id,
    ...(serializeValue(doc.data()) as FirestoreRecord),
  };
}

export async function GET() {
  try {
    const [patientsSnap, volunteersSnap, tasksSnap] = await Promise.all([
      adminDb.collection('users').where('role', '==', 'patient').get(),
      adminDb.collection('users').where('role', '==', 'volunteer').get(),
      adminDb.collection('tasks').orderBy('createdAt', 'desc').get(),
    ]);

    return NextResponse.json({
      patients: patientsSnap.docs.map(serializeDoc),
      volunteers: volunteersSnap.docs.map(serializeDoc),
      tasks: tasksSnap.docs.map(serializeDoc),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load NGO dashboard data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
