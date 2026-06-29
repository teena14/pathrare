#!/usr/bin/env python3
"""
embed_rag_chunks.py
===================
Reads all JSON files under data/rag/, embeds each chunk using
Gemini text-embedding-004, and writes data/rag/rag_index.json.

Usage:
    python scripts/embed_rag_chunks.py
    python scripts/embed_rag_chunks.py --dry-run   # parse only, no API calls

Requirements:
    pip install requests python-dotenv

Environment variables required:
    GEMINI_API_KEY  — API key from Google AI Studio
"""

import json
import os
import sys
import time
import argparse
import urllib.request
import urllib.error
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
except ImportError:
    pass

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
RAG_DIR = ROOT / "data" / "rag"
OUTPUT_FILE = RAG_DIR / "rag_index.json"

# ── Source files to embed (in priority order) ─────────────────────────────────
SOURCE_FILES = [
    "who_guidelines.json",
    "first_aid.json",
    "india_health.json",
    "omim_curated.json",
    "orphanet_curated.json",
]

# ── Gemini config ─────────────────────────────────────────────────────────────
EMBED_MODEL = "text-embedding-004"
BATCH_SIZE = 5          
RATE_LIMIT_DELAY = 1.0  

def load_all_chunks() -> list[dict]:
    all_chunks = []
    for filename in SOURCE_FILES:
        filepath = RAG_DIR / filename
        if not filepath.exists():
            print(f"  [WARN] {filename} not found — skipping.")
            continue
        with open(filepath, encoding="utf-8") as f:
            chunks = json.load(f)
        print(f"  [LOAD] {filename}: {len(chunks)} chunks")
        all_chunks.extend(chunks)
    return all_chunks

def embed_batch(
    texts: list[str],
    api_key: str
) -> list[list[float]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:embedContent?key={api_key}"
    results = []
    
    for text in texts:
        data = {
            "model": f"models/{EMBED_MODEL}",
            "content": {
                "parts": [{"text": text[:2048]}]
            }
        }
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode('utf-8'), 
            headers={'Content-Type': 'application/json'},
            method="POST"
        )
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            results.append(res_data.get('embedding', {}).get('values', []))
            
    return results

def main():
    parser = argparse.ArgumentParser(description="Embed RAG knowledge chunks via Gemini API.")
    parser.add_argument("--dry-run", action="store_true", help="Parse chunks only — no API calls.")
    args = parser.parse_args()

    print("\n=== PathRare RAG Chunk Embedder ===\n")

    print("[1/3] Loading source chunks...")
    chunks = load_all_chunks()
    print(f"      Total chunks loaded: {len(chunks)}\n")

    if args.dry_run:
        print("[DRY RUN] Skipping embedding. Chunk IDs:")
        for c in chunks:
            print(f"  - {c['id']} ({c['source']}): {c['title'][:60]}...")
        print(f"\n[DRY RUN] Would embed {len(chunks)} chunks.")
        return

    print("[2/3] Checking API Key...")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set.")
        sys.exit(1)

    print("[3/3] Embedding chunks via Gemini API...")
    embedded = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [f"{c['title']}\n\n{c['text']}" for c in batch]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Batch {batch_num}/{total_batches}: embedding {len(batch)} chunks...", end=" ")

        try:
            vectors = embed_batch(texts, api_key)
            for chunk, vec in zip(batch, vectors):
                if vec:
                    embedded.append({
                        "id": chunk["id"],
                        "source": chunk["source"],
                        "category": chunk["category"],
                        "title": chunk["title"],
                        "url": chunk.get("url", ""),
                        "text": chunk["text"],
                        "embedding": vec,
                    })
            if vectors and vectors[0]:
                print(f"OK (dim={len(vectors[0])})")
            else:
                print("OK (empty embeddings returned)")
        except urllib.error.HTTPError as e:
            print(f"FAILED: {e.code} {e.reason}")
            print("  Skipping batch.")
        except Exception as e:
            print(f"FAILED: {e}")
            print("  Skipping batch.")

        if i + BATCH_SIZE < len(chunks):
            time.sleep(RATE_LIMIT_DELAY)

    print(f"\n[4/4] Saving rag_index.json ({len(embedded)} embedded chunks)...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(embedded, f, ensure_ascii=False, indent=2)
    print(f"      Saved to: {OUTPUT_FILE}")
    print(f"\n Done! {len(embedded)}/{len(chunks)} chunks embedded successfully.\n")

if __name__ == "__main__":
    main()
