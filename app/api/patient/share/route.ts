import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// ── POST: Generate or update share token ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId } = body;

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const patientProfileRef = adminDb.collection('patientProfile').doc(patientId);
    const patientProfile = await patientProfileRef.get();

    let shareToken: string;

    if (patientProfile.exists) {
      const data = patientProfile.data();
      shareToken = data?.shareToken || randomUUID();
      
      await patientProfileRef.update({
        shareToken,
        shareEnabled: true,
        shareCreatedAt: new Date().toISOString(),
      });
    } else {
      shareToken = randomUUID();
      await patientProfileRef.set({
        patientId,
        shareToken,
        shareEnabled: true,
        shareCreatedAt: new Date().toISOString(),
        reportCount: 0,
        lastReportAt: null,
      });
    }

    // Create shared profile record
    const sharedProfileRef = adminDb.collection('sharedProfile').doc(shareToken);
    const sharedProfile = await sharedProfileRef.get();

    if (!sharedProfile.exists) {
      await sharedProfileRef.set({
        shareToken,
        patientId,
        createdAt: new Date().toISOString(),
        viewCount: 0,
      });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared/${shareToken}`;

    return NextResponse.json({ shareToken, shareUrl });
  } catch (error) {
    console.error('[POST /api/patient/share] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate share link' },
      { status: 500 }
    );
  }
}

// ── DELETE: Disable sharing ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const patientProfileRef = adminDb.collection('patientProfile').doc(patientId);
    const patientProfile = await patientProfileRef.get();

    if (!patientProfile.exists) {
      return NextResponse.json(
        { error: 'Patient profile not found' },
        { status: 404 }
      );
    }

    await patientProfileRef.update({
      shareEnabled: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/patient/share] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disable sharing' },
      { status: 500 }
    );
  }
}
