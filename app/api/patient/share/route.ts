import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })});
  }
  return getFirestore();
}

function generateToken() {
  return randomBytes(16).toString("hex");
}

// ── POST /api/patient/share ───────────────────────────────────────────────────
// Creates a shareable token for a patient's clinical profile
export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json();
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

    const db    = getAdminDb();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await db.collection("shareTokens").doc(token).set({
      token,
      patientId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/share/${token}`;
    return NextResponse.json({ shareUrl, token, expiresAt });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── GET /api/patient/share?token=xxx ─────────────────────────────────────────
// Returns public profile data for the share page
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const db       = getAdminDb();
    const tokenDoc = await db.collection("shareTokens").doc(token).get();
    if (!tokenDoc.exists) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });

    const { patientId, expiresAt } = tokenDoc.data()!;
    if (new Date(expiresAt) < new Date())
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });

    // Fetch profile, reports, documents
    const [userDoc, reportsSnap, docsSnap] = await Promise.all([
      db.collection("users").doc(patientId).get(),
      db.collection("reports").where("patientId", "==", patientId).orderBy("createdAt", "desc").limit(20).get(),
      db.collection("documents").where("patientId", "==", patientId).orderBy("uploadedAt", "desc").limit(20).get(),
    ]);

    const user = userDoc.data() || {};
    return NextResponse.json({
      patient: {
        displayName: user.displayName || "Anonymous Patient",
        primaryDisease: user.primaryDisease || null,
        diagnosisStatus: user.diagnosisStatus || null,
        location: user.location || null,
      },
      reports:   reportsSnap.docs.map(d => d.data()),
      documents: docsSnap.docs.map(d => ({ ...d.data(), storageUrl: d.data().storageUrl })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
