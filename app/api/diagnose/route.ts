/**
 * POST /api/diagnose
 *
 * Accepts a multipart form with either:
 *   - file: PDF or image (runs through Google Vision OCR)
 *   - symptoms: plain text symptom string (skips OCR)
 *
 * Pipeline:
 *   1. OCR (Google Vision API) — if file uploaded
 *   2. Symptom extraction (Gemini) — NLP from raw text
 *   3. Embed extracted symptoms (Vertex AI text-embedding-004)
 *   4. Match against pre-built disease index (cosine similarity)
 *   5. Enrich matches with ICD/OMIM from alignments.json
 *   6. Return ranked results
 *
 * All GCP calls happen here — NEVER in the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// ── Lazy-load index (cached in module scope after first request) ───────────────
let diseaseIndex: Array<{ orpha_code: string; name: string; embedding: number[] }> | null = null;
let alignments: Record<string, { icd_codes: string[]; omim: string[] }> = {};

function loadIndex() {
  if (diseaseIndex) return;

  const indexPath = path.join(process.cwd(), "data/orphanet/parsed/index.json");
  const alignPath = path.join(process.cwd(), "data/orphanet/parsed/alignments.json");

  if (fs.existsSync(indexPath)) {
    diseaseIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }

  if (fs.existsSync(alignPath)) {
    const raw: Array<{ orpha_code: string; icd_codes: string[]; omim: string[] }> =
      JSON.parse(fs.readFileSync(alignPath, "utf-8"));
    alignments = Object.fromEntries(raw.map((d) => [d.orpha_code, { icd_codes: d.icd_codes, omim: d.omim }]));
  }
}

// ── Step 1: OCR via Google Vision API ─────────────────────────────────────────
async function runOCR(fileBuffer: Buffer): Promise<string> {
  const credPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS!);
  const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));

  // Get access token from service account
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const body = {
    requests: [
      {
        image: { content: fileBuffer.toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  };

  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

// ── Step 2: Symptom extraction via Gemini ─────────────────────────────────────
async function extractSymptoms(text: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = `You are a medical NLP system. Extract all clinical symptoms and signs from the following medical text.
Return ONLY a JSON array of symptom strings, using standard medical terminology where possible.
Text:
"""${text.slice(0, 4000)}"""

Return format: ["symptom 1", "symptom 2", ...]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return [cleaned];
  }
}

// ── Step 3: Embed query via Vertex AI ─────────────────────────────────────────
async function embedSymptoms(symptoms: string[]): Promise<number[]> {
  const credPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS!);
  const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const project = process.env.GCP_PROJECT_ID ?? "rarity-f316d";
  const location = process.env.GCP_LOCATION ?? "us-central1";
  const model = "text-embedding-004";
  const text = symptoms.join("; ");

  const res = await fetch(
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({ instances: [{ content: text }] }),
    }
  );

  const data = await res.json();
  return data.predictions?.[0]?.embeddings?.values ?? [];
}

// ── Step 4: Cosine similarity match ───────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function rankDiseases(queryVec: number[], topK = 5) {
  if (!diseaseIndex) return [];

  const scores = diseaseIndex.map((d) => ({
    orpha_code: d.orpha_code,
    name: d.name,
    score: cosineSimilarity(queryVec, d.embedding),
  }));

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((d) => ({
      ...d,
      confidence: parseFloat((d.score * 100).toFixed(1)),
      icd_codes: alignments[d.orpha_code]?.icd_codes ?? [],
      omim: alignments[d.orpha_code]?.omim ?? [],
    }));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    loadIndex();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawSymptoms = formData.get("symptoms") as string | null;

    let reportText = "";

    // Step 1: OCR if file provided
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      reportText = await runOCR(buffer);
    } else if (rawSymptoms) {
      reportText = rawSymptoms;
    } else {
      return NextResponse.json({ error: "Provide a file or symptoms text." }, { status: 400 });
    }

    // Step 2: Extract symptoms with Gemini
    const symptoms = await extractSymptoms(reportText);

    // Step 3: Embed
    const queryVec = await embedSymptoms(symptoms);

    // Step 4: Match
    const matches = rankDiseases(queryVec);

    return NextResponse.json({
      symptoms_extracted: symptoms,
      report_text_preview: reportText.slice(0, 300),
      matches,
    });
  } catch (err: unknown) {
    console.error("[/api/diagnose]", err);
    const message = err instanceof Error ? err.message : "Diagnostic inference failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
