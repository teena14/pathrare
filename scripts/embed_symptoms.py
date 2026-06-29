"""
embed_symptoms.py
-----------------
Generates Gemini text embeddings for each disease's symptom profile.

Reads:   data/orphanet/parsed/diseases.json
Writes:  data/orphanet/parsed/embeddings.json

Prerequisites:
  GEMINI_API_KEY must be set in your environment (or .env.local)
"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# Load env from .env.local if running standalone
try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
except ImportError:
    pass

DISEASES_FILE = Path("data/orphanet/parsed/diseases.json")
OUT_FILE = Path("data/orphanet/parsed/embeddings.json")
BATCH_SIZE = 5  

def get_embeddings_batch(api_key: str, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
    results = []
    
    # The Gemini embedContent API only accepts one string per request natively, 
    # or you can use batchEmbedContents. For simplicity, we make sequential requests
    # or use batchEmbedContents if properly structured. We'll use sequential to avoid complexity.
    for text in texts:
        data = {
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": text[:2048]}]
            }
        }
        
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            results.append(res_data.get('embedding', {}).get('values', []))
            
    return results

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is missing.")
        return

    print("PathRare — Symptom Embedding Generator")
    print("=" * 40)
    print("  Using Gemini API (Google AI Studio)")

    with open(DISEASES_FILE, encoding="utf-8") as f:
        diseases = json.load(f)

    print(f"  Embedding {len(diseases)} diseases...")

    results = []
    for i in range(0, len(diseases), BATCH_SIZE):
        batch = diseases[i : i + BATCH_SIZE]
        texts = [d["symptom_text"] or d["name"] for d in batch]

        try:
            embeddings = get_embeddings_batch(api_key, texts)
            for disease, embedding in zip(batch, embeddings):
                if embedding:
                    results.append({
                        "orpha_code": disease["orpha_code"],
                        "name": disease["name"],
                        "embedding": embedding,
                    })
            print(f"  [{i + len(batch)}/{len(diseases)}] embedded")
        except urllib.error.HTTPError as e:
            print(f"  ⚠ HTTP Error at batch {i}: {e.code} {e.reason}")
            time.sleep(5)
        except Exception as e:
            print(f"  ⚠ Error at batch {i}: {e}")
            time.sleep(5)

        time.sleep(1)  # rate limit

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False)

    print(f"\n✅ Saved {len(results)} embeddings → {OUT_FILE}")
    print("   Run build_index.py next.")

if __name__ == "__main__":
    main()
