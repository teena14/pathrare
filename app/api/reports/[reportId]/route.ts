import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ── PATCH: Edit a report ───────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params;
    const body = await req.json();
    const { patientId, reportDiagnosis, reasoning, diagnosisMatchType } = body;

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const reportRef = adminDb.collection('reports').doc(reportId);
    const report = await reportRef.get();

    if (!report.exists) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const reportData = report.data();

    // Verify ownership
    if (reportData?.patientId !== patientId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const updateData: any = {
      isEdited: true,
      editedAt: new Date().toISOString(),
      editedBy: 'patient',
    };

    if (reportDiagnosis !== undefined) updateData.reportDiagnosis = reportDiagnosis;
    if (reasoning !== undefined) updateData.reasoning = reasoning;
    if (diagnosisMatchType !== undefined) updateData.diagnosisMatchType = diagnosisMatchType;

    await reportRef.update(updateData);

    const updatedReport = await reportRef.get();
    return NextResponse.json(updatedReport.data());
  } catch (error) {
    console.error('[PATCH /api/reports/{reportId}] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete a report ─────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params;
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const reportRef = adminDb.collection('reports').doc(reportId);
    const report = await reportRef.get();

    if (!report.exists) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const reportData = report.data();

    // Verify ownership
    if (reportData?.patientId !== patientId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await reportRef.delete();

    // Update patient profile report count
    const patientProfileRef = adminDb.collection('patientProfile').doc(patientId);
    await patientProfileRef.update({
      reportCount: FieldValue.increment(-1),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/reports/{reportId}] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
