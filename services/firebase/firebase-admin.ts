import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminCredential() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  return applicationDefault();
}

function getAdminStorageBucket() {
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}

function normalizeBucketName(bucketName?: string | null) {
  return bucketName?.replace(/^gs:\/\//, '').trim() || '';
}

export function getAdminProjectId() {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
}

export function getAdminStorageBucketCandidates() {
  const configuredBucket = normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET);
  const publicBucket = normalizeBucketName(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const projectId = getAdminProjectId();

  return Array.from(
    new Set(
      [
        configuredBucket,
        publicBucket,
        projectId ? `${projectId}.firebasestorage.app` : '',
        projectId ? `${projectId}.appspot.com` : '',
      ].filter(Boolean)
    )
  );
}

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: getAdminCredential(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: getAdminStorageBucket(),
    });

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
