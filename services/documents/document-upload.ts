export interface UploadedDocument {
  id: string;
  patientId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageUrl: string;
  storagePath: string;
  uploadedAt: string;
}

export async function uploadPatientDocument(patientId: string, file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("patientId", patientId);
  formData.append("file", file);

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Document upload failed");
  }

  return data.document as UploadedDocument;
}
