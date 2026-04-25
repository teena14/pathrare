/**
 * lib/rag.ts
 *
 * Server-side RAG (Retrieval-Augmented Generation) knowledge base module.
 * NEVER import this in client components — it reads from the filesystem.
 *
 * Usage:
 *   import { retrieveChunks, embedQuery, buildRagContext } from '@/lib/rag';
 *
 *   const queryVec = await embedQuery("What is Gaucher disease?");
 *   const chunks   = retrieveChunks(queryVec, 6);
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RagChunk {
  id: string;
  source: string;
  category: string;
  title: string;
  url: string;
  text: string;
  embedding: number[];
}

export interface RagResult {
  id: string;
  source: string;
  category: string;
  title: string;
  url: string;
  text: string;
  score: number;
}

// ── Module-level cache ─────────────────────────────────────────────────────────

let ragIndex: RagChunk[] | null = null;

// ── Index loader ───────────────────────────────────────────────────────────────

function loadRagIndex(): void {
  if (ragIndex !== null) return;

  const indexPath = path.join(process.cwd(), "data", "rag", "rag_index.json");
  if (!fs.existsSync(indexPath)) {
    console.warn(
      "[RAG] rag_index.json not found — RAG retrieval disabled. Run scripts/embed_rag_chunks.py first."
    );
    ragIndex = [];
    return;
  }

  try {
    ragIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as RagChunk[];
    console.log(`[RAG] Loaded ${ragIndex.length} knowledge chunks from rag_index.json`);
  } catch (err) {
    console.error("[RAG] Failed to parse rag_index.json:", err);
    ragIndex = [];
  }
}

// ── Math utils ─────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve the top-K most relevant RAG chunks for a given query embedding.
 * Returns empty array if the index is not yet built.
 */
export function retrieveChunks(queryEmbedding: number[], topK = 6): RagResult[] {
  loadRagIndex();

  if (!ragIndex || ragIndex.length === 0) return [];

  const scored = ragIndex.map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    category: chunk.category,
    title: chunk.title,
    url: chunk.url,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Retrieve RAG chunks filtered by a specific category.
 */
export function retrieveChunksByCategory(
  queryEmbedding: number[],
  category: string,
  topK = 4
): RagResult[] {
  loadRagIndex();

  if (!ragIndex || ragIndex.length === 0) return [];

  const filtered = ragIndex.filter((chunk) => chunk.category === category);
  const scored = filtered.map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    category: chunk.category,
    title: chunk.title,
    url: chunk.url,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Embed a query string using Vertex AI text-embedding-004.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured.");
  }

  const credPath = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), credentialsPath.replace(/^\.\//, ""));

  const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const project = process.env.GCP_PROJECT_ID ?? "rarity-f316d";
  const location = process.env.GCP_LOCATION ?? "us-central1";

  const res = await fetch(
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/text-embedding-004:predict`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({ instances: [{ content: query }] }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vertex AI embedding failed: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  return data.predictions?.[0]?.embeddings?.values ?? [];
}

/**
 * Build a grounded context block from retrieved chunks for Gemini prompts.
 */
export function buildRagContext(chunks: RagResult[]): {
  contextBlock: string;
  citations: { title: string; source: string; url: string }[];
} {
  if (chunks.length === 0) {
    return { contextBlock: "", citations: [] };
  }

  const contextBlock = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.source} — ${c.title}]\n${c.text}`)
    .join("\n\n---\n\n");

  const citations = chunks.map((c) => ({
    title: c.title,
    source: c.source,
    url: c.url,
  }));

  return { contextBlock, citations };
}

/**
 * Returns true if the RAG index has been built and is loaded.
 */
export function isRagIndexAvailable(): boolean {
  loadRagIndex();
  return ragIndex !== null && ragIndex.length > 0;
}
