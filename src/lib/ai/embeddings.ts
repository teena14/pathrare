import { logger } from "@/lib/logger";
import { VectorMatch, VectorEntry } from "@/types/diagnosis";
import { env } from "@/config/env";

export async function embedPatientText(text: string): Promise<number[] | null> {
  try {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.slice(0, 2048) }] }
      }),
    });
    
    if (!res.ok) {
      logger.warn(`[diagnose] Gemini API error: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    const embedding = data.embedding?.values as number[] | undefined;
    if (!embedding?.length) { 
      logger.warn("[diagnose] Gemini returned empty embedding"); 
      return null; 
    }
    logger.info(`[diagnose] Gemini embedding: ${embedding.length} dims`);
    return embedding;
  } catch (e) {
    logger.warn("[diagnose] Gemini embed failed (non-fatal):", e);
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { 
    dot += a[i] * b[i]; 
    na += a[i] ** 2; 
    nb += b[i] ** 2; 
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

export function searchByVector(vectorIndex: VectorEntry[], queryVec: number[], topK = 20): VectorMatch[] {
  if (!vectorIndex?.length) return [];
  return vectorIndex
    .map((entry) => ({ orpha_code: entry.orpha_code, name: entry.name, vector_score: cosine(queryVec, entry.embedding) }))
    .sort((a, b) => b.vector_score - a.vector_score)
    .slice(0, topK);
}
