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

  const indexPath = path.join(process.cwd(), "data", "orphanet", "parsed", "index.json");
  const alignPath = path.join(process.cwd(), "data", "orphanet", "parsed", "alignments.json");

  if (fs.existsSync(indexPath)) {
    diseaseIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }

  if (fs.existsSync(alignPath)) {
    const raw: Array<{ orpha_code: string; icd_codes: string[]; omim: string[] }> =
      JSON.parse(fs.readFileSync(alignPath, "utf-8"));
    alignments = Object.fromEntries(raw.map((d) => [d.orpha_code, { icd_codes: d.icd_codes, omim: d.omim }]));
  }
}

// ── Step 1: OCR via Google Vision API or PDF text extraction ───────────────────
async function runOCR(fileBuffer: Buffer, fileType: string): Promise<string> {
  // Handle PDF files with pdf-parse
  if (fileType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileBuffer);
      return data.text;
    } catch (e) {
      console.error('[OCR] PDF parse error:', e);
      return "";
    }
  }
  
  // Handle images with Google Vision API
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured.");
  }

  const credPath = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), credentialsPath);
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

// ── Step 2: Symptom extraction via Gemini ───────────────────────────────────────
async function extractSymptoms(text: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const prompt = `Extract clinical symptoms from the following medical report text. Return ONLY a JSON array of symptom strings (no explanations, no formatting). If no clear symptoms are found, return an empty array.

Text: ${text}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  
  try {
    const symptoms = JSON.parse(responseText);
    return Array.isArray(symptoms) ? symptoms : [];
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\[([\s\S]*?)\]/);
    if (jsonMatch) {
      try {
        const symptoms = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return Array.isArray(symptoms) ? symptoms : [];
      } catch (e2) {
        console.error('[SYMPTOM] Markdown parse also failed:', e2);
      }
    }
    return [];
  }
}

// ── Step 5: Extract diagnosis and compare via single Gemini call ───────────────
async function extractAndCompare(
  text: string,
  aiDiagnosis: string,
  symptoms: string[]
): Promise<{
  reportDiagnosis: string | null;
  comparison: { matchType: 'matches' | 'differs' | 'no_report_diagnosis'; reasoning: string };
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const prompt = `Extract the primary diagnosis from the medical report and compare it with the AI diagnosis.

Medical Report Text:
${text}

AI Diagnosis: ${aiDiagnosis}
Symptoms Found: ${symptoms.join(", ")}

Return ONLY a JSON object with this format:
{
  "reportDiagnosis": "Diagnosis name from report or null if none mentioned",
  "matchType": "matches" | "differs" | "no_report_diagnosis",
  "reasoning": "Brief explanation"
}

For matchType:
- "matches" if report diagnosis is same or very similar to AI diagnosis
- "differs" if report diagnosis is different from AI diagnosis
- "no_report_diagnosis" if no diagnosis is mentioned in the report`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    }
  );

  const data = await res.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  try {
    const result = JSON.parse(responseText);
    return {
      reportDiagnosis: result.reportDiagnosis || null,
      comparison: {
        matchType: result.matchType || 'no_report_diagnosis',
        reasoning: result.reasoning || 'Unable to generate reasoning.',
      },
    };
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          reportDiagnosis: result.reportDiagnosis || null,
          comparison: {
            matchType: result.matchType || 'no_report_diagnosis',
            reasoning: result.reasoning || 'Unable to generate reasoning.',
          },
        };
      } catch (e2) {
        console.error('[COMPARE] Markdown parse also failed:', e2);
      }
    }
    // Fallback
    return {
      reportDiagnosis: null,
      comparison: {
        matchType: 'no_report_diagnosis',
        reasoning: 'Failed to parse AI response. Manual review required.',
      },
    };
  }
}

// ── Step 3: Embed query via Vertex AI ─────────────────────────────────────────
async function embedSymptoms(symptoms: string[]): Promise<number[]> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured.");
  }

  const credPath = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), credentialsPath);
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
      
      // If it's a text file, read directly instead of OCR
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        reportText = buffer.toString('utf-8');
      } else {
        reportText = await runOCR(buffer, file.type);
      }
    } else if (rawSymptoms) {
      reportText = rawSymptoms;
    } else {
      return NextResponse.json({ error: "Provide a file or symptoms text." }, { status: 400 });
    }

    // Step 2: Extract symptoms via Gemini (first call)
    const symptoms = await extractSymptoms(reportText);

    // Step 3: Embed symptoms
    const queryVec = await embedSymptoms(symptoms);

    // Step 4: Match diseases
    const matches = rankDiseases(queryVec);
    const aiDiagnosis = matches[0]?.name || "Unknown";

    // Step 5: Extract report diagnosis and compare (second call - combined)
    const { reportDiagnosis, comparison } = await extractAndCompare(reportText, aiDiagnosis, symptoms);

    return NextResponse.json({
      symptoms_extracted: symptoms,
      report_text_preview: reportText.slice(0, 300),
      report_diagnosis: reportDiagnosis,
      ai_diagnosis: aiDiagnosis,
      diagnosis_match_type: comparison.matchType,
      reasoning: comparison.reasoning,
      matches,
    });
  } catch (err: unknown) {
    console.error("[/api/diagnose]", err);
    const message = err instanceof Error ? err.message : "Diagnostic inference failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
