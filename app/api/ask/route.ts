/**
 * POST /api/ask
 *
 * Grounded medical Q&A endpoint powered by RAG + patient clinical context.
 *
 * Request body (JSON):
 *   {
 *     question:    string      — the medical question
 *     patientId?:  string      — Firebase UID (fetches profile + reports)
 *     history?:    { role: 'user'|'assistant', content: string }[]
 *   }
 *
 * Response:
 *   {
 *     answer:       string
 *     sources:      { title, source, url }[]
 *     ragAvailable: boolean
 *     disclaimer:   string
 *     needsFollowUp?: boolean
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { embedQuery, retrieveChunks, buildRagContext, isRagIndexAvailable } from '@/services/ai/rag';
import { adminDb } from '@/services/firebase/firebase-admin';

const MEDICAL_DISCLAIMER =
  "This information is provided for educational purposes only from authoritative medical databases. It does not constitute medical advice. Always consult a qualified healthcare professional.";

// ── Fetch patient context from Firestore ──────────────────────────────────────

interface PatientContext {
  name: string;
  primaryDisease: string | null;
  diagnosisStatus: string | null;
  confirmedCondition: string | null;
  reportedCondition: string | null;
  age: string | null;
  gender: string | null;
  location: string | null;
  aiDiagnoses: {
    name: string;
    confidence: number;
    symptoms: string[];
    orpha_code: string;
    icd_codes: string[];
    diagnosisMatchType: string;
  }[];
  recentSymptoms: string[];
}

async function fetchPatientContext(patientId: string): Promise<PatientContext | null> {
  try {
    const [userDoc, reportsSnap] = await Promise.all([
      adminDb.collection("users").doc(patientId).get(),
      adminDb
        .collection("reports")
        .where("patientId", "==", patientId)
        .orderBy("uploadedAt", "desc")
        .limit(5)
        .get(),
    ]);

    if (!userDoc.exists) return null;

    const user = userDoc.data() as Record<string, unknown>;

    const asStr = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;

    const location = (() => {
      const loc = user.location as Record<string, unknown> | undefined;
      if (loc) {
        const parts = [asStr(loc.city), asStr(loc.state), asStr(loc.country)].filter(Boolean);
        return parts.join(", ") || asStr(user.country);
      }
      return asStr(user.country);
    })();

    // Collect all AI diagnosis reports
    const aiDiagnoses = reportsSnap.docs
      .map((doc) => {
        const r = doc.data() as Record<string, unknown>;
        const diag = r.aiDiagnosis as Record<string, unknown> | null;
        if (!diag) return null;
        return {
          name: asStr(diag.name) ?? "Unknown",
          confidence: (diag.confidence as number) ?? 0,
          symptoms: (r.symptoms as string[]) ?? [],
          orpha_code: asStr(diag.orpha_code) ?? "",
          icd_codes: (diag.icd_codes as string[]) ?? [],
          diagnosisMatchType: asStr(r.diagnosisMatchType) ?? "no_stated_disease",
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Collect all unique symptoms across reports (most recent first)
    const allSymptoms = Array.from(
      new Set(aiDiagnoses.flatMap((d) => d.symptoms))
    ).slice(0, 15);

    return {
      name: asStr(user.displayName) ?? asStr(user.firstName) ?? "Patient",
      primaryDisease: asStr(user.primaryDisease) ?? asStr(user.confirmed_condition) ?? asStr(user.reported_condition),
      diagnosisStatus: asStr(user.diagnosisStatus) ?? asStr(user.condition_status),
      confirmedCondition: asStr(user.confirmed_condition),
      reportedCondition: asStr(user.reported_condition),
      age: asStr(user.age) ?? asStr(user.dateOfBirth),
      gender: asStr(user.gender),
      location,
      aiDiagnoses,
      recentSymptoms: allSymptoms,
    };
  } catch (err) {
    console.error("[/api/ask] fetchPatientContext error:", err);
    return null;
  }
}

function buildPatientContextBlock(ctx: PatientContext): string {
  const lines: string[] = [];

  lines.push(`PATIENT PROFILE:`);
  lines.push(`Name: ${ctx.name}`);

  if (ctx.diagnosisStatus) lines.push(`Diagnosis status: ${ctx.diagnosisStatus}`);
  if (ctx.primaryDisease) lines.push(`Self-reported / primary disease: ${ctx.primaryDisease}`);
  if (ctx.confirmedCondition && ctx.confirmedCondition !== ctx.primaryDisease)
    lines.push(`Confirmed condition: ${ctx.confirmedCondition}`);
  if (ctx.reportedCondition && ctx.reportedCondition !== ctx.primaryDisease)
    lines.push(`Reported condition: ${ctx.reportedCondition}`);
  if (ctx.age) lines.push(`Age: ${ctx.age}`);
  if (ctx.gender) lines.push(`Gender: ${ctx.gender}`);
  if (ctx.location) lines.push(`Location: ${ctx.location}`);

  if (ctx.aiDiagnoses.length > 0) {
    lines.push(`\nAI DIAGNOSTIC HISTORY (${ctx.aiDiagnoses.length} reports):`);
    ctx.aiDiagnoses.forEach((d, i) => {
      lines.push(
        `  Report ${i + 1}: ${d.name} (ORPHA:${d.orpha_code}) — ${d.confidence}% confidence | Match type: ${d.diagnosisMatchType}`
      );
      if (d.icd_codes.length) lines.push(`    ICD codes: ${d.icd_codes.join(", ")}`);
    });
  }

  if (ctx.recentSymptoms.length > 0) {
    lines.push(`\nKNOWN SYMPTOMS (from all reports):`);
    lines.push(`  ${ctx.recentSymptoms.join(", ")}`);
  }

  return lines.join("\n");
}

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body.question as string | undefined)?.trim();
    const patientId = (body.patientId as string | undefined)?.trim();
    const history: { role: string; content: string }[] = body.history ?? [];
    const lang: string = (body.lang as string | undefined) ?? 'en';

    const LANGUAGE_NAMES: Record<string, string> = {
      en: 'English', hi: 'Hindi', ta: 'Tamil', mr: 'Marathi',
      te: 'Telugu', bn: 'Bengali', kn: 'Kannada', gu: 'Gujarati',
      pa: 'Punjabi', or: 'Odia',
    };
    const responseLang = LANGUAGE_NAMES[lang] ?? 'English';
    const langInstruction = lang !== 'en'
      ? `\n\nIMPORTANT: You MUST respond entirely in ${responseLang}. Every word of your answer, including medical terms where possible, must be in ${responseLang}. Do not switch to English.`
      : '';

    if (!question) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    // Step 1: Fetch patient clinical context (if logged in)
    const patientCtx = patientId ? await fetchPatientContext(patientId) : null;
    const patientBlock = patientCtx ? buildPatientContextBlock(patientCtx) : "";

    // Step 2: Embed question + patient disease context for better retrieval
    let chunks: ReturnType<typeof retrieveChunks> = [];
    let contextBlock = "";
    let citations: { title: string; source: string; url: string }[] = [];
    const ragAvailable = isRagIndexAvailable();

    if (ragAvailable) {
      // Enrich query with patient disease for better RAG retrieval
      const ragQuery = patientCtx?.primaryDisease
        ? `${question} — patient has: ${patientCtx.primaryDisease}`
        : question;
      const queryVec = await embedQuery(ragQuery);
      chunks = retrieveChunks(queryVec, 8);
      const built = buildRagContext(chunks);
      contextBlock = built.contextBlock;
      citations = built.citations;
    }

    // Step 3: Build conversation history block
    const historyBlock =
      history.length > 0
        ? "\nCONVERSATION HISTORY:\n" +
          history
            .slice(-6) // last 3 exchanges
            .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`)
            .join("\n")
        : "";

    // Step 4: Build the grounded prompt
    const patientSection = patientBlock
      ? `\n---\n${patientBlock}\n---\n`
      : "\n[No patient profile linked — answering generally]\n";

    const ragSection = ragAvailable && contextBlock
      ? `REFERENCE KNOWLEDGE BASE (WHO · NIH · CDC · Orphanet · OMIM · Red Cross · NHM India):\n${contextBlock}\n\nUse the knowledge base above as your PRIMARY reference when it covers the topic. If it does not fully cover the question, freely draw on your comprehensive medical training to give a complete, accurate answer — never say you cannot answer due to lack of sources.`
      : `KNOWLEDGE BASE: Not yet indexed. Answer fully using your comprehensive medical training — you have broad knowledge of rare diseases, clinical guidelines, emergency care, medications, genetics, and Indian health policy.`;

    const prompt = `You are PathRare's Care & Medical Knowledge Assistant — a compassionate specialist AI for rare disease patients.

Your core behaviour:
- ALWAYS personalise your answer to the patient's known disease, diagnosis status, and symptoms from their profile below.
- If the question relates to their condition, explicitly reference their specific disease and known symptoms.
- Use the knowledge base as your first reference. If it doesn't cover the question, answer fully from your own broad medical knowledge — never refuse or say you lack information.
- When you cite from the knowledge base, name the source (e.g., "According to WHO guidelines..."). When using your own training, you can say "Based on current medical understanding...".
- If the question involves emergency symptoms, ALWAYS start with "Call 112 immediately" and give step-by-step first aid.
- If you need one specific piece of information to give a better personalised answer, ask ONE short follow-up question at the end.
- End every answer with a brief warm reminder to consult their specialist.${langInstruction}
${patientSection}
${ragSection}${historyBlock}

PATIENT QUESTION: ${question}

RESPONSE GUIDELINES:
1. Open by connecting the question to the patient's specific condition (if profile is available).
2. Give a thorough, accurate answer — never cut short because of missing local sources.
3. Be specific: mention disease mechanisms, drug classes, gene names, clinical codes where relevant.
4. Ask ONE follow-up question at the end only if genuinely needed for personalisation.
5. Tone: warm, clear, and empathetic — the patient may be anxious or dealing with a lot.`;

    // Step 5: Call Gemini
    const answer = await callGemini(prompt);

    // Detect if AI asked a follow-up question
    const needsFollowUp =
      answer.includes("?") &&
      (answer.toLowerCase().includes("could you") ||
        answer.toLowerCase().includes("can you tell") ||
        answer.toLowerCase().includes("would you") ||
        answer.toLowerCase().includes("do you know") ||
        answer.toLowerCase().includes("what is your") ||
        answer.toLowerCase().includes("how long") ||
        answer.toLowerCase().includes("are you"));

    return NextResponse.json({
      answer,
      sources: citations,
      ragAvailable,
      disclaimer: MEDICAL_DISCLAIMER,
      needsFollowUp,
    });
  } catch (err: unknown) {
    console.error("[/api/ask]", err);
    const message = err instanceof Error ? err.message : "Failed to process your question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
