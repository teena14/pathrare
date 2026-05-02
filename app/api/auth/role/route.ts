import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    const normalizedEmail = email ? normalizeEmail(email) : '';

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }

    const snap = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();

    if (snap.empty) {
      return NextResponse.json({ role: null });
    }

    const role = snap.docs[0]?.data()?.role;
    return NextResponse.json({ role: typeof role === 'string' ? role : null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to look up account role.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
