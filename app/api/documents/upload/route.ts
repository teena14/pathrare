import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

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

    const bucket = adminStorage.bucket();
    if (!bucket.name) {
      return NextResponse.json(
        { error: "Firebase Storage bucket is not configured on the server" },
        { status: 500 }
      );
    }

    const safeFileName = sanitizeFileName(file.name || "document");
    const storagePath = `patients/${patientId}/documents/${Date.now()}_${safeFileName}`;
    const contentType = file.type || "application/octet-stream";
    const downloadToken = randomUUID();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const ref = adminDb.collection("documents").doc();
    const document = {
      id: ref.id,
      patientId,
      fileName: safeFileName,
      fileSize: file.size,
      fileType: contentType,
      storagePath,
      storageUrl: buildDownloadUrl(bucket.name, storagePath, downloadToken),
      uploadedAt: new Date().toISOString(),
    };

    await ref.set(document);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
