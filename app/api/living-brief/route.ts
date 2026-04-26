/**
 * POST /api/living-brief
 *
 * Generates a personalised "Living Brief" clinical summary for a patient
 * based on their extracted symptoms and top disease matches.
 *
 * Uses Gemini to produce a structured, patient-readable document.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Dynamic model discovery (fetches from Gemini API, cached per server start) ──
let cachedModels: string[] | null = null;

async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (cachedModels) return cachedModels;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    const data = await res.json();
    if (!data.models) {
      console.warn("[living-brief] Could not fetch model list, using defaults.");
      return ["gemini-2.0-flash", "gemini-1.5-flash"];
    }
    const models: string[] = data.models
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent")
      )
      .map((m: { name: string }) => m.name.replace("models/", ""));
    console.log(`[living-brief] Available models (${models.length}):`, models.join(", "));
    cachedModels = models;
    return models;
  } catch (err) {
    console.warn("[living-brief] Failed to fetch model list:", err);
    return ["gemini-2.0-flash", "gemini-1.5-flash"];
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const models = await getAvailableModels(apiKey);
  let lastError = "";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }
    );
    const data = await res.json();
    if (res.status === 429 || data.error?.code === 429) {
      console.warn(`[living-brief] ${model} rate-limited, trying next...`);
      lastError = `Rate limit on ${model}`;
      continue;
    }
    if (data.error) {
      const msg = data.error.message ?? JSON.stringify(data.error);
      console.error(`[living-brief] ${model} error:`, msg);
      lastError = `Gemini error (${model}): ${msg}`;
      continue;
    }
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) {
      lastError = `${model} returned empty content`;
      continue;
    }
    console.log(`[living-brief] Success with model: ${model}`);
    return text;
  }
  throw new Error(
    `All Gemini models are rate-limited or unavailable. Wait a minute and retry. Last error: ${lastError}`
  );
}

interface DiseaseMatch {
  orpha_code: string;
  name: string;
  confidence: number;
  icd_codes: string[];
  omim: string[];
  reasoning?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symptoms: string[] = body.symptoms ?? [];
    const matches: DiseaseMatch[] = body.matches ?? [];
    const patientName: string = body.patientName ?? "Patient";

    if (symptoms.length === 0 && matches.length === 0) {
      return NextResponse.json(
        { error: "No diagnostic data provided to generate a brief." },
        { status: 400 }
      );
    }

    const lang: string = body.lang ?? 'en';
    const LANGUAGE_NAMES: Record<string, string> = {
      en: 'English', hi: 'Hindi', ta: 'Tamil', mr: 'Marathi',
      te: 'Telugu', bn: 'Bengali', kn: 'Kannada', gu: 'Gujarati',
      pa: 'Punjabi', or: 'Odia',
    };
    const responseLang = LANGUAGE_NAMES[lang] ?? 'English';
    const langInstruction = lang !== 'en'
      ? `\n\nIMPORTANT: Write the entire Living Brief in ${responseLang}. All headings, bullet points, and text must be in ${responseLang}.`
      : '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in .env.local." },
        { status: 500 }
      );
    }

    const topMatch = matches[0];
    const matchList = matches
      .map(
        (m, i) =>
          `${i + 1}. ${m.name} (ORPHA:${m.orpha_code}) — ${m.confidence}% confidence${
            m.reasoning ? ` — ${m.reasoning}` : ""
          }`
      )
      .join("\n");

    const prompt = `You are a compassionate clinical documentation specialist for rare disease patients.

Generate a "Living Brief" — a structured, patient-friendly clinical summary — based on the diagnostic data below.

PATIENT: ${patientName}
SYMPTOMS IDENTIFIED: ${symptoms.join(", ") || "Not specified"}
TOP DISEASE MATCHES:
${matchList || "None"}

The Living Brief should include these sections:
1. **Clinical Snapshot** — A concise 2-3 sentence summary of the patient's presentation and most likely diagnosis.
2. **Symptom Profile** — A clear list of identified symptoms grouped by body system where possible.
3. **Most Likely Diagnosis** — Detailed explanation of the top match (${topMatch?.name ?? "unknown"}), what it is, and why it fits.
4. **Differential Diagnoses** — Brief notes on the other matches and how they differ.
5. **Recommended Next Steps** — Specific, actionable clinical recommendations (specialist referrals, tests, genetic counselling etc.).
6. **Patient Resources** — Suggest 2-3 types of support resources relevant to rare disease patients in India (organisations, helplines, support groups).

Guidelines:
- Write at B2 English level — clear and accessible to non-medical readers.
- Use empathetic, supportive language.
- Be clinically accurate but avoid unnecessary jargon.
- Format with clear markdown headings and bullet points.${langInstruction}

Return ONLY the Living Brief markdown content. No preamble.`;

    const briefText = await callGemini(apiKey, prompt);

    return NextResponse.json({
      brief: briefText,
      generatedAt: new Date().toISOString(),
      basedOn: {
        symptoms,
        topMatch: topMatch
          ? { name: topMatch.name, orpha_code: topMatch.orpha_code }
          : null,
      },
    });
  } catch (err: unknown) {
    console.error("[/api/living-brief]", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate Living Brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
