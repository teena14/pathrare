import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

// ── DELETE /api/reports/[reportId] ────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("reports").doc(reportId);
    const doc = await ref.get();

    if (!doc.exists || doc.data()?.patientId !== patientId)
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── PATCH /api/reports/[reportId] ─────────────────────────────────────────────
// Body: { patientId, diagnosisChoice: 'change'|'keep'|'skip', newDiseaseName? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await req.json();
    const { patientId, diagnosisChoice, newDiseaseName } = body;

    if (!patientId || !diagnosisChoice)
      return NextResponse.json({ error: "patientId + diagnosisChoice required" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("reports").doc(reportId);
    const doc = await ref.get();

    if (!doc.exists || doc.data()?.patientId !== patientId)
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });

    const update: Record<string, unknown> = { diagnosisChoice, updatedAt: new Date().toISOString() };
    await ref.update(update);

    // If user chose to change to AI diagnosis — update their profile
    if (diagnosisChoice === "change" && newDiseaseName) {
      await db.collection("users").doc(patientId).set(
        { primaryDisease: newDiseaseName, lastDiagnosisDate: new Date().toISOString() },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
