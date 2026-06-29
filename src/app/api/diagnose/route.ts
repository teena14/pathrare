import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runOCR } from "@/lib/ocr";
import { embedPatientText, searchByVector } from "@/lib/ai/embeddings";
import { extractSymptomsAndMatch, generateAISummary, buildDiseaseListForPrompt } from "@/lib/ai/prompts";
import { 
  loadOrphanetData, 
  loadHPOData, 
  loadVectorIndex, 
  findHPOCodesInText, 
  scoreByHPO, 
  mergeMatches, 
  getAlignments, 
  getVectorIndex 
} from "@/features/diagnosis/hpo";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    loadOrphanetData();
    loadHPOData();
    loadVectorIndex();

    if (!getAlignments().length) {
      return apiError("Disease database not loaded.", 500);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawSymptoms = formData.get("symptoms") as string | null;
    const statedDisease = (formData.get("stated_disease") as string | null)?.trim() || null;
    const lang = (formData.get("lang") as string | null) ?? 'en';
    let reportText = "";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        reportText = buffer.toString("utf-8");
      } else {
        reportText = await runOCR(buffer, file.type);
      }
      if (!reportText.trim()) {
        return apiError("Could not extract text from your document. This can happen with scanned images or password-protected PDFs. Please try the 'Enter Symptoms' tab and describe your symptoms in text instead.", 422);
      }
    } else if (rawSymptoms?.trim()) {
      reportText = rawSymptoms.trim();
    } else {
      return apiError("Provide a file or symptoms text.", 400);
    }

    // Step 1: HPO pre-match from raw text
    const preHPOCodes = findHPOCodesInText(reportText);
    const preHPOMatches = scoreByHPO(preHPOCodes);
    logger.info(`[diagnose] Pre-matched ${preHPOCodes.length} HP codes -> ${preHPOMatches.length} candidates`);

    // Step 2: Gemini - symptoms + disease matches
    const diseaseList = buildDiseaseListForPrompt(preHPOMatches, getAlignments());
    const { symptoms, matches: geminiMatches } = await extractSymptomsAndMatch(reportText, diseaseList);

    // Step 3: Merge pre + Gemini HP codes, re-score
    const patientHPOCodes = [...new Set([...preHPOCodes, ...symptoms.map((s) => s.hpo_code).filter((c) => c.startsWith("HP:"))])];
    const hpoMatches = scoreByHPO(patientHPOCodes);
    logger.info(`[diagnose] Final: ${hpoMatches.length} HPO candidates from ${patientHPOCodes.length} HP codes`);

    // Step 4: Vector search
    const symptomText = symptoms.length > 0 ? symptoms.map((s) => s.term).join(", ") : reportText.slice(0, 500);
    const queryVec = await embedPatientText(symptomText);
    const vectorMatches = queryVec ? searchByVector(getVectorIndex() || [], queryVec) : [];
    if (vectorMatches.length) logger.info(`[diagnose] Vector search: ${vectorMatches.length} candidates`);

    // Step 5: Merge
    const matches = mergeMatches(geminiMatches, hpoMatches, vectorMatches, patientHPOCodes.length);

    // Step 6: Generate Summary
    const { ai_summary, diagnosis_match_type, mismatch_reasoning } = await generateAISummary(symptoms, matches, statedDisease, lang);

    return apiSuccess({
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
    return apiError(err instanceof Error ? err.message : "Diagnostic inference failed.", 500, err);
  }
}
