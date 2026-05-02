import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ── GET: Get shared profile data (view-only for doctors) ───────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    // Get shared profile
    const sharedProfileRef = adminDb.collection('sharedProfile').doc(shareToken);
    const sharedProfile = await sharedProfileRef.get();

    if (!sharedProfile.exists) {
      return NextResponse.json(
        { error: 'Shared profile not found or expired' },
        { status: 404 }
      );
    }

    const sharedData = sharedProfile.data();
    const patientId = sharedData?.patientId;

    // Check if sharing is enabled
    const patientProfileRef = adminDb.collection('patientProfile').doc(patientId);
    const patientProfile = await patientProfileRef.get();

    if (!patientProfile.exists) {
      return NextResponse.json(
        { error: 'Patient profile not found' },
        { status: 404 }
      );
    }

    const patientData = patientProfile.data();

    if (!patientData?.shareEnabled) {
      return NextResponse.json(
        { error: 'Sharing is disabled for this profile' },
        { status: 403 }
      );
    }

    // Get all reports for the patient
    const reportsSnapshot = await adminDb
      .collection('reports')
      .where('patientId', '==', patientId)
      .orderBy('uploadedAt', 'desc')
      .get();

    const reports = reportsSnapshot.docs.map((doc) => doc.data());

    // Update view count
    await sharedProfileRef.update({
      viewCount: FieldValue.increment(1),
      lastViewedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      patientId,
      shareToken,
      reports,
      reportCount: reports.length,
      lastReportAt: patientData?.lastReportAt,
    });
  } catch (error) {
    console.error('[GET /api/shared/{shareToken}] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared profile' },
      { status: 500 }
    );
  }
}
