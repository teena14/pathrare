import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage, getAdminStorageBucketCandidates } from "@/lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

function parseBucketFromStorageUrl(storageUrl?: string) {
  if (!storageUrl) return "";

  const match = storageUrl.match(/\/b\/([^/]+)\//);
  return match?.[1] || "";
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
    const storageBucket = doc.data()?.storageBucket || parseBucketFromStorageUrl(doc.data()?.storageUrl);
    if (storagePath) {
      const bucketCandidates = Array.from(
        new Set([storageBucket, ...getAdminStorageBucketCandidates()].filter(Boolean))
      );

      for (const bucketName of bucketCandidates) {
        try {
          await adminStorage.bucket(bucketName).file(storagePath).delete();
          break;
        } catch {
          // If the file is missing or the bucket is invalid, continue cleanup.
        }
      }
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
