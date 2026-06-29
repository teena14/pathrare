import { logger } from "@/lib/logger";
import { SymptomWithHPO, FinalMatch, GeminiMatch, HPOMatch, AlignmentEntry } from "@/types/diagnosis";
import { callGemini } from "./gemini";
import { env } from "@/config/env";

export interface AISummaryResult {
  ai_summary: string;
  diagnosis_match_type: "matches" | "differs" | "no_stated_disease";
  mismatch_reasoning: string;
}

export async function generateAISummary(
  symptoms: SymptomWithHPO[],
  matches: FinalMatch[],
  statedDisease: string | null,
  lang = 'en'
): Promise<AISummaryResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || !matches.length) {
    return { ai_summary: "Unable to generate summary.", diagnosis_match_type: "no_stated_disease", mismatch_reasoning: "" };
  }

  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', ta: 'Tamil', mr: 'Marathi',
    te: 'Telugu', bn: 'Bengali', kn: 'Kannada', gu: 'Gujarati',
    pa: 'Punjabi', or: 'Odia',
  };
  const responseLang = LANGUAGE_NAMES[lang] ?? 'English';
  const langInstruction = lang !== 'en' ? `\n\nIMPORTANT: Respond entirely in ${responseLang}. The JSON values must be in ${responseLang}.` : '';

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
3. mismatch_reasoning: if differs, explain specifically why the AI thinks differently (1-2 sentences referencing clinical evidence). If matches, write "The AI assessment aligns with the patient's reported diagnosis.". If no stated disease, write "No prior diagnosis was provided for comparison."${langInstruction}

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
  } catch (e) {
    logger.warn("[diagnose] Failed to generate AI summary", e);
    return {
      ai_summary: `AI identified ${topMatch.name} (ORPHA:${topMatch.orpha_code}) as the most likely diagnosis based on ${symptoms.length} extracted clinical features with a combined confidence score of ${topMatch.confidence}%.`,
      diagnosis_match_type: statedDisease ? "differs" : "no_stated_disease",
      mismatch_reasoning: "",
    };
  }
}

export function buildDiseaseListForPrompt(hpoCandidates: HPOMatch[] = [], alignments: AlignmentEntry[] = []): string {
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

export async function extractSymptomsAndMatch(text: string, diseaseList: string): Promise<{ symptoms: SymptomWithHPO[]; matches: GeminiMatch[] }> {
  const apiKey = env.GEMINI_API_KEY;
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
    try { 
      logger.warn("[diagnose] JSON repair used"); 
      return parse(repairJson(cleaned)); 
    }
    catch { throw new Error(`Gemini returned malformed JSON. Snippet: ${cleaned.slice(0, 200)}`); }
  }
}
