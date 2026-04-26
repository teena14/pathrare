import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

// ── POST /api/documents ───────────────────────────────────────────────────────
// Saves document metadata after client-side Firebase Storage upload
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, fileName, fileSize, fileType, storageUrl, storagePath } = body;
    if (!patientId || !fileName || !storageUrl)
      return NextResponse.json({ error: "patientId, fileName, storageUrl required" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("documents").doc();
    const doc = {
      id: ref.id,
      patientId,
      fileName,
      fileSize: fileSize || 0,
      fileType: fileType || "application/octet-stream",
      storageUrl,
      storagePath: storagePath || "",
      uploadedAt: new Date().toISOString(),
    };
    await ref.set(doc);
    return NextResponse.json({ id: ref.id, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── GET /api/documents?patientId=xxx ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

    const db   = getAdminDb();
    const snap = await db.collection("documents")
      .where("patientId", "==", patientId)
      .orderBy("uploadedAt", "desc")
      .limit(50)
      .get();

    return NextResponse.json({ documents: snap.docs.map(d => d.data()) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
