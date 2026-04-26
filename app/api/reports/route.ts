/**
 * POST /api/reports
 * Saves a diagnostic report to Firestore under the patient's uid.
 *
 * GET /api/reports?patientId=xxx
 * Retrieves all reports for a patient (ordered by date desc).
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ── Firebase Admin init ────────────────────────────────────────────────────────
function getAdminDb() {
  return adminDb;
}

// ── POST — save a report ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      fileName,
      fileType,
      reportText,
      symptoms,
      symptoms_with_hpo,
      hpo_codes_used,
      aiDiagnosis,
      allMatches,
      statedDisease,
      diagnosisMatchType,
      aiSummary,
      mismatchReasoning,
      diagnosisChoice,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required." }, { status: 400 });
    }

    const db = getAdminDb();
    const reportRef = db.collection("reports").doc();

    const report = {
      id: reportRef.id,
      patientId,
      fileName: fileName || "Symptom Input",
      fileType: fileType || "text",
      reportText: reportText || "",
      symptoms: symptoms || [],
      symptoms_with_hpo: symptoms_with_hpo || [],
      hpo_codes_used: hpo_codes_used || [],
      aiDiagnosis: aiDiagnosis || null,
      allMatches: allMatches || [],
      statedDisease: statedDisease || null,
      diagnosisMatchType: diagnosisMatchType || "no_stated_disease",
      diagnosisChoice: diagnosisChoice || null,
      aiSummary: aiSummary || "",
      mismatchReasoning: mismatchReasoning || "",
      createdAt: new Date().toISOString(),
    };

    await reportRef.set(report);

    // Also update the patient's lastDiagnosis in their user doc
    if (aiDiagnosis?.name) {
      await db.collection("users").doc(patientId).set({
        lastDiagnosis: aiDiagnosis.name,
        lastDiagnosisDate: report.createdAt,
        lastDiagnosisOrpha: aiDiagnosis.orpha_code || null,
      }, { merge: true });
    }

    return NextResponse.json({ id: reportRef.id, success: true });
  } catch (err: unknown) {
    console.error("[/api/reports POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save report." },
      { status: 500 }
    );
  }
}

// ── GET — retrieve reports ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) {
      return NextResponse.json({ error: "patientId query param required." }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db
      .collection("reports")
      .where("patientId", "==", patientId)
      .get();

    const reports = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 20);
    return NextResponse.json({ reports });
  } catch (err: unknown) {
    console.error("[/api/reports GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch reports." },
      { status: 500 }
    );
  }
}
