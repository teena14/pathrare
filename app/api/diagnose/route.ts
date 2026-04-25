/**
 * POST /api/diagnose
 *
 * Pipeline:
 *   1. OCR (Google Vision API) — if image uploaded
 *      OR pdf-parse — if PDF uploaded
 *      OR plain text — if symptoms typed
 *   2. HPO text pre-matching (no AI) — scans text for HPO term names
 *   3. HPO Jaccard scoring — ranks diseases by phenotype overlap
 *   4. Gemini — extracts symptoms + HP codes, ranks top diseases
 *      (HPO candidates highlighted in prompt for better accuracy)
 *   5. Merge LLM + HPO scores (55% Gemini + 45% HPO evidence)
 *   6. Enrich with ICD/OMIM from alignments.json
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AlignmentEntry {
  orpha_code: string;
  name: string;
  icd_codes: string[];
  omim: string[];
}
interface ClassificationEntry { orpha_code: string; name: string; type: string; }
interface HPOTerm { id: string; name: string; synonyms: string[]; definition: string; }
interface SymptomWithHPO { term: string; hpo_code: string; }
interface GeminiMatch { orpha_code: string; name: string; confidence: number; score: number; reasoning: string; }
interface HPOMatch { orpha_code: string; name: string; hpo_score: number; matched_hpo: { code: string; name: string }[]; }
interface VectorMatch { orpha_code: string; name: string; vector_score: number; }
interface VectorEntry { orpha_code: string; name: string; embedding: number[]; }
interface FinalMatch {
  orpha_code: string; name: string; confidence: number;
  gemini_confidence: number; hpo_score: number; vector_score: number; combined_score: number;
  reasoning: string; icd_codes: string[]; omim: string[];
  matched_hpo: { code: string; name: string }[];
}

// ── Module-level caches ────────────────────────────────────────────────────────
let alignments: AlignmentEntry[] = [];
let diseaseNameMap: Map<string, AlignmentEntry> = new Map();
let omimToOrpha: Map<string, string> = new Map();
let hpoTerms: Map<string, HPOTerm> = new Map();
let diseaseHPO: Map<string, Set<string>> = new Map();
let hpoToDisease: Map<string, Set<string>> = new Map();
let hpoTextLookup: Map<string, string> = new Map();
let vectorIndex: VectorEntry[] | null = null;  // null = not loaded yet, [] = not available
let cachedModels: string[] | null = null;
let hpoLoaded = false;

// ── Orphanet loader ────────────────────────────────────────────────────────────
function loadOrphanetData() {
  if (alignments.length > 0) return;
  const alignPath = path.join(process.cwd(), "data", "orphanet", "parsed", "alignments.json");
  const classPath = path.join(process.cwd(), "data", "orphanet", "parsed", "classifications.json");
  if (fs.existsSync(alignPath)) {
    const raw: AlignmentEntry[] = JSON.parse(fs.readFileSync(alignPath, "utf-8"));
    alignments = raw;
    diseaseNameMap = new Map(raw.map((d) => [d.orpha_code, d]));
  }
  const missing = alignments.filter((d) => !d.name).length;
  if (missing > 0 && fs.existsSync(classPath)) {
    const classes: ClassificationEntry[] = JSON.parse(fs.readFileSync(classPath, "utf-8"));
    const cm = new Map(classes.map((c) => [c.orpha_code, c.name]));
    alignments = alignments.map((d) => ({ ...d, name: d.name || cm.get(d.orpha_code) || `ORPHA:${d.orpha_code}` }));
    diseaseNameMap = new Map(alignments.map((d) => [d.orpha_code, d]));
  }
  for (const e of alignments) for (const o of e.omim) omimToOrpha.set(`OMIM:${o}`, e.orpha_code);
  console.log(`[diagnose] ${alignments.length} Orphanet diseases loaded`);
}

// ── Vector index loader ────────────────────────────────────────────────────────
function loadVectorIndex() {
  if (vectorIndex !== null) return; // already attempted
  const indexPath = path.join(process.cwd(), "data", "orphanet", "parsed", "index.json");
  if (fs.existsSync(indexPath)) {
    vectorIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as VectorEntry[];
    console.log(`[diagnose] Vector index loaded: ${vectorIndex.length} disease embeddings`);
  } else {
    vectorIndex = []; // mark as attempted — won't retry
    console.log("[diagnose] No index.json found — vector search disabled (run scripts/build_hpo_index.py)");
  }
}

// ── HPO loader ─────────────────────────────────────────────────────────────────
// ── Vertex AI — embed patient symptom text ────────────────────────────────────
async function embedPatientText(text: string): Promise<number[] | null> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath || !vectorIndex?.length) return null;

  try {
    const credPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.join(process.cwd(), credentialsPath);
    const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const token = await (await auth.getClient()).getAccessToken();

    const project  = process.env.GCP_PROJECT_ID ?? "rarity-f316d";
    const location = process.env.GCP_LOCATION ?? "us-central1";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify({ instances: [{ content: text.slice(0, 2048) }] }),
    });
    const data = await res.json();
    const embedding = data.predictions?.[0]?.embeddings?.values as number[] | undefined;
    if (!embedding?.length) { console.warn("[diagnose] Vertex AI returned empty embedding"); return null; }
    console.log(`[diagnose] Vertex AI embedding: ${embedding.length} dims`);
    return embedding;
  } catch (e) {
    console.warn("[diagnose] Vertex AI embed failed (non-fatal):", e);
    return null;
  }
}

// ── Cosine similarity vector search ───────────────────────────────────────────
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

function searchByVector(queryVec: number[], topK = 20): VectorMatch[] {
  if (!vectorIndex?.length) return [];
  return vectorIndex
    .map((entry) => ({ orpha_code: entry.orpha_code, name: entry.name, vector_score: cosine(queryVec, entry.embedding) }))
    .sort((a, b) => b.vector_score - a.vector_score)
    .slice(0, topK);
}
// ── HPO Data Loader ────────────────────────────────────────────────────────────
function loadHPOData() {
  if (hpoLoaded) return;
  hpoLoaded = true;

  const oboPath = path.join(process.cwd(), "data", "hpo", "hp.obo");
  if (fs.existsSync(oboPath)) {
    const lines = fs.readFileSync(oboPath, "utf-8").split(/\r?\n/);
    let cur: HPOTerm | null = null;
    for (const line of lines) {
      if (line === "[Term]") {
        if (cur?.id && cur?.name) hpoTerms.set(cur.id, cur);
        cur = { id: "", name: "", synonyms: [], definition: "" };
      } else if (line === "[Typedef]") {
        if (cur?.id && cur?.name) hpoTerms.set(cur.id, cur);
        break;
      } else if (!cur) continue;
      else if (line.startsWith("id: ")) cur.id = line.slice(4).trim();
      else if (line.startsWith("name: ")) cur.name = line.slice(6).trim();
      else if (line.startsWith("def: ")) cur.definition = line.slice(5).match(/^"([^"]*)"/)?.[1] ?? "";
      else if (line.startsWith("synonym: ")) { const m = line.match(/synonym: "([^"]+)"/); if (m) cur.synonyms.push(m[1]); }
    }
    if (cur?.id && cur?.name) hpoTerms.set(cur.id, cur);
    console.log(`[diagnose] ${hpoTerms.size} HPO terms loaded`);
  }

  const hpoaPath = path.join(process.cwd(), "data", "hpo", "phenotype.hpoa");
  if (fs.existsSync(hpoaPath)) {
    let added = 0;
    for (const line of fs.readFileSync(hpoaPath, "utf-8").split(/\r?\n/)) {
      if (line.startsWith("#") || !line.trim()) continue;
      const p = line.split("\t");
      if (p.length < 11 || p[2] === "NOT" || p[10] !== "P" || !p[3].startsWith("HP:")) continue;
      if (!diseaseHPO.has(p[0])) diseaseHPO.set(p[0], new Set());
      diseaseHPO.get(p[0])!.add(p[3]);
      if (!hpoToDisease.has(p[3])) hpoToDisease.set(p[3], new Set());
      hpoToDisease.get(p[3])!.add(p[0]);
      added++;
    }
    console.log(`[diagnose] ${added} HPO annotations for ${diseaseHPO.size} diseases`);
  }

  for (const [id, term] of hpoTerms) {
    if (term.name.length >= 8) hpoTextLookup.set(term.name.toLowerCase(), id);
    for (const syn of term.synonyms) if (syn.length >= 8) hpoTextLookup.set(syn.toLowerCase(), id);
  }
  console.log(`[diagnose] ${hpoTextLookup.size} HPO text lookup entries`);
}

// ── HPO scoring ────────────────────────────────────────────────────────────────
function scoreByHPO(codes: string[]): HPOMatch[] {
  if (!codes.length || !hpoToDisease.size) return [];
  const patientSet = new Set(codes);
  const scores = new Map<string, { count: number; matched: string[] }>();
  for (const hpoId of codes) {
    for (const diseaseId of hpoToDisease.get(hpoId) ?? []) {
      if (!scores.has(diseaseId)) scores.set(diseaseId, { count: 0, matched: [] });
      const s = scores.get(diseaseId)!; s.count++; s.matched.push(hpoId);
    }
  }
  const results: HPOMatch[] = [];
  for (const [diseaseId, { count, matched }] of scores) {
    let orphaCode: string | undefined;
    if (diseaseId.startsWith("ORPHA:")) orphaCode = diseaseId.slice(6);
    else if (diseaseId.startsWith("OMIM:")) orphaCode = omimToOrpha.get(diseaseId);
    if (!orphaCode) continue;
    const al = diseaseNameMap.get(orphaCode);
    if (!al?.name) continue;
    const dSet = diseaseHPO.get(diseaseId) ?? new Set<string>();
    const union = new Set([...patientSet, ...dSet]).size;
    results.push({ orpha_code: orphaCode, name: al.name, hpo_score: count / union,
      matched_hpo: matched.map((c) => ({ code: c, name: hpoTerms.get(c)?.name ?? c })) });
  }
  return results.sort((a, b) => b.hpo_score - a.hpo_score).slice(0, 20);
}

function findHPOCodesInText(text: string): string[] {
  if (!hpoTextLookup.size) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [term, id] of hpoTextLookup) if (lower.includes(term)) found.add(id);
  return Array.from(found);
}

// ── Merge: Gemini + HPO + Vector (3-way weighted scoring) ─────────────────────
function mergeMatches(
  geminiMatches: GeminiMatch[],
  hpoMatches: HPOMatch[],
  vectorMatches: VectorMatch[],
  patientHPOCount: number
): FinalMatch[] {
  // Weights: adaptively shift if vector index is available
  const hasVector = vectorMatches.length > 0;
  const W_GEMINI = hasVector ? 0.45 : 0.55;
  const W_HPO    = hasVector ? 0.35 : 0.45;
  const W_VECTOR = hasVector ? 0.20 : 0.00;

  const merged = new Map<string, FinalMatch>();

  // Helper: get vector score for a given orpha_code (normalised 0-1)
  const vectorMap = new Map(vectorMatches.map((v) => [v.orpha_code, v.vector_score]));
  const maxVectorScore = Math.max(...vectorMatches.map((v) => v.vector_score), 1e-6);

  function normaliseVector(score: number) { return score / maxVectorScore; }

  // ── Seed with Gemini matches ─────────────────────────────────────────────
  for (const m of geminiMatches) {
    const gc  = typeof m.confidence === "number" ? m.confidence : Math.round((m.score ?? 0) * 100);
    const hd  = hpoMatches.find((h) => h.orpha_code === m.orpha_code);
    const hs  = hd?.hpo_score ?? 0;
    const vs  = normaliseVector(vectorMap.get(m.orpha_code) ?? 0);
    const combined = W_GEMINI * (gc / 100) + W_HPO * hs + W_VECTOR * vs;
    const local = diseaseNameMap.get(m.orpha_code);
    merged.set(m.orpha_code, {
      orpha_code: m.orpha_code, name: m.name, gemini_confidence: gc,
      hpo_score: hs, vector_score: vectorMap.get(m.orpha_code) ?? 0,
      combined_score: combined, confidence: Math.round(combined * 100),
      reasoning: m.reasoning ?? "",
      icd_codes: local?.icd_codes ?? [], omim: local?.omim ?? [],
      matched_hpo: hd?.matched_hpo ?? [],
    });
  }

  // ── Add HPO-only matches ─────────────────────────────────────────────────
  for (const h of hpoMatches) {
    if (merged.has(h.orpha_code)) continue;
    const precision = h.matched_hpo.length / Math.max(1, patientHPOCount);
    const vs = normaliseVector(vectorMap.get(h.orpha_code) ?? 0);
    const combined = W_HPO * precision + W_VECTOR * vs;
    const local = diseaseNameMap.get(h.orpha_code);
    merged.set(h.orpha_code, {
      orpha_code: h.orpha_code, name: h.name, gemini_confidence: 0,
      hpo_score: h.hpo_score, vector_score: vectorMap.get(h.orpha_code) ?? 0,
      combined_score: combined, confidence: Math.round(combined * 100),
      reasoning: `Identified via HPO: ${h.matched_hpo.slice(0, 3).map((t) => t.name).join(", ")}.`,
      icd_codes: local?.icd_codes ?? [], omim: local?.omim ?? [],
      matched_hpo: h.matched_hpo,
    });
  }

  // ── Add vector-only matches (not in Gemini or HPO lists) ─────────────────
  for (const v of vectorMatches) {
    if (merged.has(v.orpha_code)) continue;
    const vs = normaliseVector(v.vector_score);
    const combined = W_VECTOR * vs;
    if (combined < 0.05) continue; // skip low-confidence vector-only hits
    const local = diseaseNameMap.get(v.orpha_code);
    merged.set(v.orpha_code, {
      orpha_code: v.orpha_code, name: v.name, gemini_confidence: 0,
      hpo_score: 0, vector_score: v.vector_score, combined_score: combined,
      confidence: Math.round(combined * 100),
      reasoning: "Identified via semantic vector similarity to disease phenotype profile.",
      icd_codes: local?.icd_codes ?? [], omim: local?.omim ?? [],
      matched_hpo: [],
    });
  }

  return Array.from(merged.values()).sort((a, b) => b.combined_score - a.combined_score).slice(0, 5);
}

// ── AI Summary Generator ─────────────────────────────────────────────────────────────
interface AISummaryResult {
  ai_summary: string;
  diagnosis_match_type: "matches" | "differs" | "no_stated_disease";
  mismatch_reasoning: string;
}

async function generateAISummary(
  symptoms: SymptomWithHPO[],
  matches: FinalMatch[],
  statedDisease: string | null
): Promise<AISummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !matches.length) {
    return { ai_summary: "Unable to generate summary.", diagnosis_match_type: "no_stated_disease", mismatch_reasoning: "" };
  }

  const topMatch = matches[0];
  const hpoCodes = topMatch.matched_hpo.slice(0, 8).map((h) => `${h.name} (${h.code})`).join(", ");
  const icdCodes = topMatch.icd_codes.slice(0, 3).join(", ") || "Not available";
  const omimCodes = topMatch.omim.slice(0, 3).join(", ") || "Not available";
  const otherMatches = matches.slice(1, 4).map((m) => `${m.name} (${m.confidence}%)`).join(", ");
  const symptomList = symptoms.slice(0, 10).map((s) => s.hpo_code ? `${s.term} (${s.hpo_code})` : s.term).join("; ");

  const statedSection = statedDisease
    ? `The patient's self-reported diagnosis is: "${statedDisease}".`
    : "The patient has not stated a prior diagnosis.";

  const prompt = `You are a senior clinical AI diagnostician generating a Second Opinion report for a rare disease patient.

${statedSection}

Extracted symptoms: ${symptomList}

Top AI diagnosis: ${topMatch.name} (ORPHA:${topMatch.orpha_code}) — ${topMatch.confidence}% confidence
Alternative considerations: ${otherMatches}
Matching HPO phenotypes: ${hpoCodes || "None"}
ICD codes: ${icdCodes} | OMIM: ${omimCodes}
AI Reasoning: ${topMatch.reasoning}

Generate a JSON object with:
1. ai_summary: 3-4 sentence clinical narrative explaining why the AI identified this disease, referencing specific symptoms, HPO codes, and clinical codes. Write for a knowledgeable patient/caregiver.
2. diagnosis_match_type: "matches" if stated disease is the same as AI top pick, "differs" if different, "no_stated_disease" if no stated disease
3. mismatch_reasoning: if differs, explain specifically why the AI thinks differently (1-2 sentences referencing clinical evidence). If matches, write "The AI assessment aligns with the patient's reported diagnosis.". If no stated disease, write "No prior diagnosis was provided for comparison."

JSON only, no markdown:
{"ai_summary":"...","diagnosis_match_type":"matches|differs|no_stated_disease","mismatch_reasoning":"..."}`;

  try {
    const raw = await callGemini(apiKey, prompt);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      ai_summary: parsed.ai_summary ?? "Summary unavailable.",
      diagnosis_match_type: parsed.diagnosis_match_type ?? "no_stated_disease",
      mismatch_reasoning: parsed.mismatch_reasoning ?? "",
    };
  } catch {
    return {
      ai_summary: `AI identified ${topMatch.name} (ORPHA:${topMatch.orpha_code}) as the most likely diagnosis based on ${symptoms.length} extracted clinical features with a combined confidence score of ${topMatch.confidence}%.`,
      diagnosis_match_type: statedDisease ? "differs" : "no_stated_disease",
      mismatch_reasoning: "",
    };
  }
}

// ── OCR ────────────────────────────────────────────────────────────────────────
async function extractWithGemini(fileBuffer: Buffer, mimeType: string, apiKey: string): Promise<string> {
  const models = await getAvailableModels(apiKey);
  const b64 = fileBuffer.toString("base64");
  for (const model of models.slice(0, 2)) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: "Extract ALL text from this document verbatim. Include every medical term, diagnosis, symptom, lab value, and code. Output only the raw text, no commentary." }
          ]}],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        }),
      });
      const d = await res.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text.trim()) { console.log(`[OCR] Gemini extracted ${text.length} chars from ${mimeType}`); return text; }
    } catch (e) { console.warn(`[OCR] Gemini model ${model} failed:`, e); }
  }
  return "";
}

async function runOCR(fileBuffer: Buffer, fileType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  console.log(`[OCR] type=${fileType} size=${fileBuffer.length}b`);

  if (fileType === "application/pdf") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(fileBuffer);
      const text = result.text?.trim() ?? "";
      if (text.length > 50) { console.log(`[OCR] pdf-parse: ${text.length} chars`); return text; }
      console.log("[OCR] pdf-parse returned empty — Gemini fallback");
    } catch (e) { console.warn("[OCR] pdf-parse failed:", e); }
    if (apiKey) return extractWithGemini(fileBuffer, "application/pdf", apiKey);
    return "";
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    try {
      const credPath = path.isAbsolute(credentialsPath) ? credentialsPath : path.join(process.cwd(), credentialsPath);
      const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/cloud-vision"] });
      const token = await (await auth.getClient()).getAccessToken();
      const vRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
        body: JSON.stringify({ requests: [{ image: { content: fileBuffer.toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
      });
      const vText = (await vRes.json()).responses?.[0]?.fullTextAnnotation?.text ?? "";
      if (vText.trim()) { console.log(`[OCR] Vision API: ${vText.length} chars`); return vText; }
      console.log("[OCR] Vision API empty — Gemini fallback");
    } catch (e) { console.warn("[OCR] Vision API failed:", e); }
  } else { console.log("[OCR] No GCP creds — using Gemini directly"); }

  const mime = fileType.startsWith("image/") ? fileType : "image/png";
  if (apiKey) return extractWithGemini(fileBuffer, mime, apiKey);
  return "";
}

// ── Gemini helpers ─────────────────────────────────────────────────────────────
async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (cachedModels) return cachedModels;
  try {
    const d = await (await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)).json();
    if (!d.models) return ["gemini-2.0-flash", "gemini-1.5-flash"];
    cachedModels = d.models.filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: { name: string }) => m.name.replace("models/", ""));
    return cachedModels!;
  } catch { return ["gemini-2.0-flash", "gemini-1.5-flash"]; }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const models = await getAvailableModels(apiKey);
  let lastError = "";
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }),
    });
    const d = await res.json();
    if (res.status === 429 || d.error?.code === 429) { lastError = `Rate limit: ${model}`; continue; }
    if (d.error) { lastError = `${model}: ${d.error.message}`; continue; }
    const text: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) { lastError = `${model} empty`; continue; }
    console.log(`[diagnose] OK: ${model}`);
    return text;
  }
  throw new Error(`All Gemini models unavailable. Last: ${lastError}`);
}

// ── Disease list builder ───────────────────────────────────────────────────────
function buildDiseaseListForPrompt(hpoCandidates: HPOMatch[] = []): string {
  const prioritySet = new Set(hpoCandidates.map((h) => h.orpha_code));
  const priorityLines = hpoCandidates.slice(0, 15)
    .map((h) => `${h.orpha_code}|${h.name} [HPO: ${h.matched_hpo.slice(0, 3).map((t) => t.name).join(", ")}]`);
  const named = alignments.filter((d) => d.name && d.name.length > 2 && !d.name.startsWith("OBSOLETE") && !prioritySet.has(d.orpha_code));
  const generalLines = [
    ...named.filter((d) => d.icd_codes?.length > 0).slice(0, 150),
    ...named.filter((d) => !d.icd_codes?.length).slice(0, 50),
  ].map((d) => `${d.orpha_code}|${d.name}`);
  const parts: string[] = [];
  if (priorityLines.length) parts.push(`=== HPO PRE-MATCHED (consider first) ===\n${priorityLines.join("\n")}`);
  parts.push(`=== ALL DISEASES ===\n${generalLines.join("\n")}`);
  return parts.join("\n\n");
}

// ── Gemini extraction ──────────────────────────────────────────────────────────
async function extractSymptomsAndMatch(text: string, diseaseList: string): Promise<{ symptoms: SymptomWithHPO[]; matches: GeminiMatch[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");

  const prompt = `You are a clinical rare-disease diagnostic AI.

PATIENT TEXT: """${text.slice(0, 2000)}"""

DISEASE LIST:
${diseaseList}

TASK: Return JSON with:
1. symptoms: extract clinical findings, map each to HPO code (HP:XXXXXXX format)
2. matches: top 5 diseases from list, ranked by confidence 0-100

Rules:
- Diseases marked [HPO PRE-MATCHED] have database evidence — prioritize if clinically appropriate
- Only use orpha_codes from the provided list
- Keep reasoning brief (1 sentence)

JSON format (no markdown):
{"symptoms":[{"term":"name","hpo_code":"HP:XXXXXXX"}],"matches":[{"orpha_code":"12345","name":"Disease","confidence":85,"score":0.85,"reasoning":"reason"}]}`;

  const raw = await callGemini(apiKey, prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();

  function repairJson(s: string): string {
    let str = s.trimEnd().replace(/,\s*$/, "");
    let braces = 0, brackets = 0, inString = false, escaped = false;
    for (const ch of str) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") braces++; else if (ch === "}") braces--;
      else if (ch === "[") brackets++; else if (ch === "]") brackets--;
    }
    return str + "]".repeat(Math.max(0, brackets)) + "}".repeat(Math.max(0, braces));
  }

  function parse(json: string) {
    const p = JSON.parse(json);
    const symptoms: SymptomWithHPO[] = Array.isArray(p.symptoms)
      ? p.symptoms.map((s: unknown) => typeof s === "string" ? { term: s, hpo_code: "" } : { term: (s as SymptomWithHPO).term ?? "", hpo_code: (s as SymptomWithHPO).hpo_code ?? "" })
      : [];
    return { symptoms, matches: Array.isArray(p.matches) ? p.matches : [] };
  }

  try { return parse(cleaned); }
  catch {
    try { console.warn("[diagnose] JSON repair used"); return parse(repairJson(cleaned)); }
    catch { throw new Error(`Gemini returned malformed JSON. Snippet: ${cleaned.slice(0, 200)}`); }
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    loadOrphanetData();
    loadHPOData();
    loadVectorIndex();

    if (!alignments.length) return NextResponse.json({ error: "Disease database not loaded." }, { status: 500 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawSymptoms = formData.get("symptoms") as string | null;
    const statedDisease = (formData.get("stated_disease") as string | null)?.trim() || null;
    let reportText = "";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        reportText = buffer.toString("utf-8");
      } else {
        reportText = await runOCR(buffer, file.type);
      }
      if (!reportText.trim()) return NextResponse.json({
        error: "Could not extract text from your document. This can happen with scanned images or password-protected PDFs. Please try the 'Enter Symptoms' tab and describe your symptoms in text instead.",
      }, { status: 422 });
    } else if (rawSymptoms?.trim()) {
      reportText = rawSymptoms.trim();
    } else {
      return NextResponse.json({ error: "Provide a file or symptoms text." }, { status: 400 });
    }

    // Step 1: HPO pre-match from raw text
    const preHPOCodes = findHPOCodesInText(reportText);
    const preHPOMatches = scoreByHPO(preHPOCodes);
    console.log(`[diagnose] Pre-matched ${preHPOCodes.length} HP codes → ${preHPOMatches.length} candidates`);

    // Step 2: Gemini — symptoms + disease matches (HPO candidates highlighted)
    const { symptoms, matches: geminiMatches } = await extractSymptomsAndMatch(reportText, buildDiseaseListForPrompt(preHPOMatches));

    // Step 3: Merge pre + Gemini HP codes, re-score
    const patientHPOCodes = [...new Set([...preHPOCodes, ...symptoms.map((s) => s.hpo_code).filter((c) => c.startsWith("HP:"))])];
    const hpoMatches = scoreByHPO(patientHPOCodes);
    console.log(`[diagnose] Final: ${hpoMatches.length} HPO candidates from ${patientHPOCodes.length} HP codes`);

    // Step 4: Vertex AI vector search (non-blocking, graceful if index missing)
    const symptomText = symptoms.length > 0
      ? symptoms.map((s) => s.term).join(", ")
      : reportText.slice(0, 500);
    const queryVec = await embedPatientText(symptomText);
    const vectorMatches = queryVec ? searchByVector(queryVec) : [];
    if (vectorMatches.length) console.log(`[diagnose] Vector search: ${vectorMatches.length} candidates`);

    // Step 5: 3-way merge (Gemini 45% + HPO 35% + Vector 20%)
    const matches = mergeMatches(geminiMatches, hpoMatches, vectorMatches, patientHPOCodes.length);

    // Step 6: Generate AI narrative summary + mismatch analysis
    const { ai_summary, diagnosis_match_type, mismatch_reasoning } =
      await generateAISummary(symptoms, matches, statedDisease);

    return NextResponse.json({
      symptoms_extracted: symptoms.map((s) => s.term),
      symptoms_with_hpo: symptoms,
      hpo_codes_used: patientHPOCodes,
      report_text_preview: reportText.slice(0, 300),
      stated_disease: statedDisease,
      ai_summary,
      diagnosis_match_type,
      mismatch_reasoning,
      matches,
    });
  } catch (err: unknown) {
    console.error("[/api/diagnose]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Diagnostic inference failed." }, { status: 500 });
  }
}

