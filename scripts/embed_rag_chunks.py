#!/usr/bin/env python3
"""
embed_rag_chunks.py
===================
Reads all JSON files under data/rag/, embeds each chunk using
Vertex AI text-embedding-004, and writes data/rag/rag_index.json.

Usage:
    python scripts/embed_rag_chunks.py
    python scripts/embed_rag_chunks.py --dry-run   # parse only, no API calls

Requirements:
    pip install google-auth requests

Environment variables required:
    GOOGLE_APPLICATION_CREDENTIALS  — path to GCP service account JSON
    GCP_PROJECT_ID                  — GCP project ID
    GCP_LOCATION                    — GCP region (e.g. us-central1)
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path

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

# ── Vertex AI config ──────────────────────────────────────────────────────────
EMBED_MODEL = "text-embedding-004"
TASK_TYPE = "RETRIEVAL_DOCUMENT"
BATCH_SIZE = 5          # Vertex AI allows up to 5 instances per request
RATE_LIMIT_DELAY = 1.0  # seconds between batches to avoid quota errors


def load_all_chunks() -> list[dict]:
    """Load and merge chunks from all source JSON files."""
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


def get_vertex_token(credentials_path: str, creds: dict) -> str:
    """Obtain a Bearer token from the GCP service account credentials."""
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    sa_creds = service_account.Credentials.from_service_account_info(
        creds, scopes=scopes
    )
    sa_creds.refresh(Request())
    return sa_creds.token


def embed_batch(
    texts: list[str],
    token: str,
    project: str,
    location: str,
) -> list[list[float]]:
    """Call Vertex AI embeddings endpoint for a batch of texts."""
    import urllib.request

    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
        f"/locations/{location}/publishers/google/models/{EMBED_MODEL}:predict"
    )
    instances = [{"content": t, "task_type": TASK_TYPE} for t in texts]
    payload = json.dumps({"instances": instances}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    return [p["embeddings"]["values"] for p in data["predictions"]]


def main():
    parser = argparse.ArgumentParser(description="Embed RAG knowledge chunks via Vertex AI.")
    parser.add_argument("--dry-run", action="store_true", help="Parse chunks only — no API calls.")
    args = parser.parse_args()

    print("\n=== PathRare RAG Chunk Embedder ===\n")

    # 1. Load all chunks
    print("[1/4] Loading source chunks...")
    chunks = load_all_chunks()
    print(f"      Total chunks loaded: {len(chunks)}\n")

    if args.dry_run:
        print("[DRY RUN] Skipping embedding. Chunk IDs:")
        for c in chunks:
            print(f"  - {c['id']} ({c['source']}): {c['title'][:60]}...")
        print(f"\n[DRY RUN] Would embed {len(chunks)} chunks.")
        return

    # 2. Load GCP credentials
    print("[2/4] Loading GCP credentials...")
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    project = os.environ.get("GCP_PROJECT_ID", "rarity-f316d")
    location = os.environ.get("GCP_LOCATION", "us-central1")

    if not creds_path:
        # Try loading .env.local
        env_file = ROOT / ".env.local"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("GOOGLE_APPLICATION_CREDENTIALS="):
                    creds_path = line.split("=", 1)[1].strip()
                elif line.startswith("GCP_PROJECT_ID="):
                    project = line.split("=", 1)[1].strip()
                elif line.startswith("GCP_LOCATION="):
                    location = line.split("=", 1)[1].strip()

    if not creds_path:
        print("ERROR: GOOGLE_APPLICATION_CREDENTIALS not set.")
        sys.exit(1)

    # Resolve relative path
    if not os.path.isabs(creds_path):
        creds_path = str(ROOT / creds_path.lstrip("./"))

    with open(creds_path, encoding="utf-8") as f:
        creds = json.load(f)

    print(f"      Project: {project}  |  Location: {location}")
    print(f"      Service account: {creds.get('client_email', 'unknown')}\n")

    # 3. Embed in batches
    print("[3/4] Embedding chunks via Vertex AI...")
    token = get_vertex_token(creds_path, creds)
    embedded = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [f"{c['title']}\n\n{c['text']}" for c in batch]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Batch {batch_num}/{total_batches}: embedding {len(batch)} chunks...", end=" ")

        try:
            vectors = embed_batch(texts, token, project, location)
            for chunk, vec in zip(batch, vectors):
                embedded.append({
                    "id": chunk["id"],
                    "source": chunk["source"],
                    "category": chunk["category"],
                    "title": chunk["title"],
                    "url": chunk.get("url", ""),
                    "text": chunk["text"],
                    "embedding": vec,
                })
            print(f"OK (dim={len(vectors[0])})")
        except Exception as e:
            print(f"FAILED: {e}")
            print("  Refreshing token and retrying once...")
            token = get_vertex_token(creds_path, creds)
            try:
                vectors = embed_batch(texts, token, project, location)
                for chunk, vec in zip(batch, vectors):
                    embedded.append({
                        "id": chunk["id"],
                        "source": chunk["source"],
                        "category": chunk["category"],
                        "title": chunk["title"],
                        "url": chunk.get("url", ""),
                        "text": chunk["text"],
                        "embedding": vec,
                    })
                print(f"  Retry OK (dim={len(vectors[0])})")
            except Exception as e2:
                print(f"  Retry FAILED: {e2} — skipping batch.")

        if i + BATCH_SIZE < len(chunks):
            time.sleep(RATE_LIMIT_DELAY)

    # 4. Save index
    print(f"\n[4/4] Saving rag_index.json ({len(embedded)} embedded chunks)...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(embedded, f, ensure_ascii=False, indent=2)
    print(f"      Saved to: {OUTPUT_FILE}")
    print(f"\n Done! {len(embedded)}/{len(chunks)} chunks embedded successfully.\n")


if __name__ == "__main__":
    main()
