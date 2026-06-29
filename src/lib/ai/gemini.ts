import { logger } from "@/lib/logger";

let cachedModels: string[] | null = null;

export async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (cachedModels) return cachedModels;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const d = await res.json();
    if (!d.models) return ["gemini-2.0-flash", "gemini-1.5-flash"];
    cachedModels = d.models
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: { name: string }) => m.name.replace("models/", ""));
    return cachedModels!;
  } catch (e) { 
    logger.warn("Failed to fetch available Gemini models", e);
    return ["gemini-2.0-flash", "gemini-1.5-flash"]; 
  }
}

export async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const models = await getAvailableModels(apiKey);
  let lastError = "";
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }),
      });
      const d = await res.json();
      if (res.status === 429 || d.error?.code === 429) { lastError = `Rate limit: ${model}`; continue; }
      if (d.error) { lastError = `${model}: ${d.error.message}`; continue; }
      const text: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text.trim()) { lastError = `${model} empty`; continue; }
      logger.info(`[diagnose] OK: ${model}`);
      return text;
    } catch (e) {
      lastError = `${model}: ${(e as Error).message}`;
    }
  }
  throw new Error(`All Gemini models unavailable. Last: ${lastError}`);
}
