import { logger } from "@/lib/logger";

let cachedModels: string[] | null = null;

async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (cachedModels) return cachedModels;
  try {
    const d = await (await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)).json();
    if (!d.models) return ["gemini-2.0-flash", "gemini-1.5-flash"];
    cachedModels = d.models
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: { name: string }) => m.name.replace("models/", ""));
    return cachedModels!;
  } catch (e) {
    logger.warn("Failed to fetch available Gemini models, falling back to defaults", e);
    return ["gemini-2.0-flash", "gemini-1.5-flash"];
  }
}

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
      if (text.trim()) { 
        logger.info(`[OCR] Gemini extracted ${text.length} chars from ${mimeType}`); 
        return text; 
      }
    } catch (e) { 
      logger.warn(`[OCR] Gemini model ${model} failed`, e); 
    }
  }
  return "";
}

/**
 * Extracts text from an uploaded image or PDF document.
 * Tries Tesseract/pdf-img-convert first, falling back to Gemini Vision API if empty or failed.
 */
export async function runOCR(fileBuffer: Buffer, fileType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  logger.info(`[OCR] type=${fileType} size=${fileBuffer.length}b`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Tesseract = require("tesseract.js");

    if (fileType === "application/pdf") {
      logger.info("[OCR] Converting PDF to images...");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf2img = require("pdf-img-convert");
      
      const pdfArray = await pdf2img.convert(fileBuffer);
      let fullText = "";
      
      for (let i = 0; i < pdfArray.length; i++) {
        logger.info(`[OCR] Processing PDF page ${i + 1}/${pdfArray.length}`);
        const pageBuffer = Buffer.from(pdfArray[i]);
        const result = await Tesseract.recognize(pageBuffer, 'eng');
        fullText += result.data.text + "\n\n";
      }
      
      if (fullText.trim().length > 50) {
        logger.info(`[OCR] Tesseract PDF: ${fullText.length} chars`);
        return fullText;
      }
      logger.warn("[OCR] Tesseract PDF returned empty - Gemini fallback");
      if (apiKey) return extractWithGemini(fileBuffer, "application/pdf", apiKey);
      return "";
    } else {
      logger.info("[OCR] Running Tesseract on image...");
      const result = await Tesseract.recognize(fileBuffer, 'eng');
      
      if (result.data.text.trim().length > 50) {
        logger.info(`[OCR] Tesseract Image: ${result.data.text.length} chars`);
        return result.data.text;
      }
      logger.warn("[OCR] Tesseract Image empty - Gemini fallback");
      const mime = fileType.startsWith("image/") ? fileType : "image/png";
      if (apiKey) return extractWithGemini(fileBuffer, mime, apiKey);
      return "";
    }
  } catch (e) {
    logger.warn("[OCR] Tesseract/pdf-img-convert failed", e);
    const mime = fileType.startsWith("image/") ? fileType : "image/png";
    if (apiKey) return extractWithGemini(fileBuffer, mime, apiKey);
    return "";
  }
}
