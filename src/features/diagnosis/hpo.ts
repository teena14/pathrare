import * as fs from "fs";
import * as path from "path";
import { logger } from "@/lib/logger";
import { AlignmentEntry, ClassificationEntry, HPOTerm, HPOMatch, VectorMatch, GeminiMatch, FinalMatch, VectorEntry } from "@/types/diagnosis";

// ── Module-level caches ────────────────────────────────────────────────────────
let alignments: AlignmentEntry[] = [];
let diseaseNameMap: Map<string, AlignmentEntry> = new Map();
let omimToOrpha: Map<string, string> = new Map();
let hpoTerms: Map<string, HPOTerm> = new Map();
let diseaseHPO: Map<string, Set<string>> = new Map();
let hpoToDisease: Map<string, Set<string>> = new Map();
let hpoTextLookup: Map<string, string> = new Map();
let vectorIndex: VectorEntry[] | null = null;
let hpoLoaded = false;

export function getAlignments() {
  return alignments;
}

export function getVectorIndex() {
  return vectorIndex;
}

export function loadOrphanetData() {
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
  logger.info(`[diagnose] ${alignments.length} Orphanet diseases loaded`);
}

export function loadVectorIndex() {
  if (vectorIndex !== null) return;
  const indexPath = path.join(process.cwd(), "data", "orphanet", "parsed", "index.json");
  if (fs.existsSync(indexPath)) {
    vectorIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as VectorEntry[];
    logger.info(`[diagnose] Vector index loaded: ${vectorIndex.length} disease embeddings`);
  } else {
    vectorIndex = [];
    logger.info("[diagnose] No index.json found - vector search disabled");
  }
}

export function loadHPOData() {
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
    logger.info(`[diagnose] ${hpoTerms.size} HPO terms loaded`);
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
    logger.info(`[diagnose] ${added} HPO annotations for ${diseaseHPO.size} diseases`);
  }

  for (const [id, term] of hpoTerms) {
    if (term.name.length >= 8) hpoTextLookup.set(term.name.toLowerCase(), id);
    for (const syn of term.synonyms) if (syn.length >= 8) hpoTextLookup.set(syn.toLowerCase(), id);
  }
  logger.info(`[diagnose] ${hpoTextLookup.size} HPO text lookup entries`);
}

export function findHPOCodesInText(text: string): string[] {
  if (!hpoTextLookup.size) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [term, id] of hpoTextLookup) if (lower.includes(term)) found.add(id);
  return Array.from(found);
}

export function scoreByHPO(codes: string[]): HPOMatch[] {
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

export function mergeMatches(
  geminiMatches: GeminiMatch[],
  hpoMatches: HPOMatch[],
  vectorMatches: VectorMatch[],
  patientHPOCount: number
): FinalMatch[] {
  const hasVector = vectorMatches.length > 0;
  const W_GEMINI = hasVector ? 0.45 : 0.55;
  const W_HPO    = hasVector ? 0.35 : 0.45;
  const W_VECTOR = hasVector ? 0.20 : 0.00;

  const merged = new Map<string, FinalMatch>();
  const vectorMap = new Map(vectorMatches.map((v) => [v.orpha_code, v.vector_score]));
  const maxVectorScore = Math.max(...vectorMatches.map((v) => v.vector_score), 1e-6);

  function normaliseVector(score: number) { return score / maxVectorScore; }

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

  for (const v of vectorMatches) {
    if (merged.has(v.orpha_code)) continue;
    const vs = normaliseVector(v.vector_score);
    const combined = W_VECTOR * vs;
    if (combined < 0.05) continue;
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
