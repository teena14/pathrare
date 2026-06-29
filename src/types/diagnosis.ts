export interface AlignmentEntry {
  orpha_code: string;
  name: string;
  icd_codes: string[];
  omim: string[];
}

export interface ClassificationEntry {
  orpha_code: string;
  name: string;
  type: string;
}

export interface HPOTerm {
  id: string;
  name: string;
  synonyms: string[];
  definition: string;
}

export interface SymptomWithHPO {
  term: string;
  hpo_code: string;
}

export interface GeminiMatch {
  orpha_code: string;
  name: string;
  confidence: number;
  score: number;
  reasoning: string;
}

export interface HPOMatch {
  orpha_code: string;
  name: string;
  hpo_score: number;
  matched_hpo: { code: string; name: string }[];
}

export interface VectorMatch {
  orpha_code: string;
  name: string;
  vector_score: number;
}

export interface VectorEntry {
  orpha_code: string;
  name: string;
  embedding: number[];
}

export interface FinalMatch {
  orpha_code: string;
  name: string;
  confidence: number;
  gemini_confidence: number;
  hpo_score: number;
  vector_score: number;
  combined_score: number;
  reasoning: string;
  icd_codes: string[];
  omim: string[];
  matched_hpo: { code: string; name: string }[];
}
