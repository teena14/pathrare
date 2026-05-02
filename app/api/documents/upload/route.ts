import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage, getAdminStorageBucketCandidates } from '@/services/firebase/firebase-admin';

export const runtime = "nodejs";

const ACCEPTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/#?%*:|"<>]/g, "_");
}

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function isMissingBucketError(error: unknown) {
  return String(error).toLowerCase().includes("specified bucket does not exist");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const patientId = String(formData.get("patientId") || "").trim();
    const file = formData.get("file");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required" }, { status: 400 });
    }

    if (file.type && !ACCEPTED_DOCUMENT_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const bucketCandidates = getAdminStorageBucketCandidates();
    if (bucketCandidates.length === 0) {
      return NextResponse.json(
        { error: "Firebase Storage bucket is not configured on the server" },
        { status: 500 }
      );
    }

    const safeFileName = sanitizeFileName(file.name || "document");
    const storagePath = `patients/${patientId}/documents/${Date.now()}_${safeFileName}`;
    const contentType = file.type || "application/octet-stream";
    const downloadToken = randomUUID();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let resolvedBucketName = "";
    let lastBucketError: unknown;

    for (const bucketName of bucketCandidates) {
      try {
        await adminStorage.bucket(bucketName).file(storagePath).save(fileBuffer, {
          resumable: false,
          contentType,
          metadata: {
            contentType,
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });
        resolvedBucketName = bucketName;
        break;
      } catch (error) {
        lastBucketError = error;
        if (!isMissingBucketError(error)) {
          throw error;
        }
      }
    }

    if (!resolvedBucketName) {
      throw new Error(
        `No Firebase Storage bucket found. Tried: ${bucketCandidates.join(", ")}. Last error: ${String(lastBucketError)}`
      );
    }

    const ref = adminDb.collection("documents").doc();
    const document = {
      id: ref.id,
      patientId,
      fileName: safeFileName,
      fileSize: file.size,
      fileType: contentType,
      storageBucket: resolvedBucketName,
      storagePath,
      storageUrl: buildDownloadUrl(resolvedBucketName, storagePath, downloadToken),
      uploadedAt: new Date().toISOString(),
    };

    await ref.set(document);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
