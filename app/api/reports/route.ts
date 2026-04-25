import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ── POST: Create a new report with diagnosis ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      fileName,
      fileType,
      reportText,
      symptoms,
      aiDiagnosis,
      allMatches,
      reportDiagnosis,
      diagnosisMatchType,
      reasoning,
    } = body;

    if (!patientId || !fileName || !symptoms || !aiDiagnosis) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, fileName, symptoms, aiDiagnosis' },
        { status: 400 }
      );
    }

    const reportId = randomUUID();
    const now = new Date().toISOString();

    const reportData = {
      reportId,
      patientId,
      fileName,
      fileType: fileType || 'unknown',
      uploadedAt: now,
      reportText: reportText || '',
      symptoms,
      aiDiagnosis,
      allMatches: allMatches || [],
      reportDiagnosis: reportDiagnosis || null,
      diagnosisMatchType,
      reasoning: reasoning || '',
      isEdited: false,
    };

    await adminDb.collection('reports').doc(reportId).set(reportData);

    // Update patient profile report count
    const patientProfileRef = adminDb.collection('patientProfile').doc(patientId);
    const patientProfile = await patientProfileRef.get();
    
    if (patientProfile.exists) {
      await patientProfileRef.update({
        reportCount: FieldValue.increment(1),
        lastReportAt: now,
      });
    } else {
      await patientProfileRef.set({
        patientId,
        shareToken: randomUUID(),
        shareEnabled: false,
        shareCreatedAt: now,
        reportCount: 1,
        lastReportAt: now,
      });
    }

    return NextResponse.json(reportData, { status: 201 });
  } catch (error) {
    console.error('[POST /api/reports] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

// ── GET: Get all reports for a patient ───────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection('reports')
      .where('patientId', '==', patientId)
      .orderBy('uploadedAt', 'desc')
      .get();

    const reports = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[GET /api/reports] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
