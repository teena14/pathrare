import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

// ── DELETE /api/documents/[docId] ─────────────────────────────────────────────
// Removes metadata from Firestore and deletes the stored file server-side
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("documents").doc(docId);
    const doc = await ref.get();

    if (!doc.exists || doc.data()?.patientId !== patientId)
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });

    const storagePath = doc.data()?.storagePath;
    if (storagePath) {
      try {
        await adminStorage.bucket().file(storagePath).delete();
      } catch {
        // If the file is already missing, still allow metadata cleanup.
      }
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
