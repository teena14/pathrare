"""
embed_symptoms.py
-----------------
Generates Vertex AI text embeddings for each disease's symptom profile.

Reads:   data/orphanet/parsed/diseases.json
Writes:  data/orphanet/parsed/embeddings.json

Prerequisites:
  pip install google-cloud-aiplatform
  GOOGLE_APPLICATION_CREDENTIALS must point to credentials/gcp-service-account.json
"""

import json
import os
import time
from pathlib import Path

# Load env from .env.local if running standalone
try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
except ImportError:
    pass

import vertexai
from vertexai.language_models import TextEmbeddingModel

DISEASES_FILE = Path("data/orphanet/parsed/diseases.json")
OUT_FILE = Path("data/orphanet/parsed/embeddings.json")
BATCH_SIZE = 5  # Vertex AI rate limit — keep low


def get_embeddings_batch(model, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using Vertex AI text-embedding-004."""
    response = model.get_embeddings(texts)
    return [r.values for r in response]


def main():
    project_id = os.environ.get("GCP_PROJECT_ID", "rarity-f316d")
    location = os.environ.get("GCP_LOCATION", "us-central1")

    print("PathRare — Symptom Embedding Generator")
    print("=" * 40)
    print(f"  Project: {project_id} | Location: {location}")

    vertexai.init(project=project_id, location=location)
    model = TextEmbeddingModel.from_pretrained("text-embedding-004")

    with open(DISEASES_FILE, encoding="utf-8") as f:
        diseases = json.load(f)

    print(f"  Embedding {len(diseases)} diseases...")

    results = []
    for i in range(0, len(diseases), BATCH_SIZE):
        batch = diseases[i : i + BATCH_SIZE]
        texts = [d["symptom_text"] or d["name"] for d in batch]

        try:
            embeddings = get_embeddings_batch(model, texts)
            for disease, embedding in zip(batch, embeddings):
                results.append({
                    "orpha_code": disease["orpha_code"],
                    "name": disease["name"],
                    "embedding": embedding,
                })
            print(f"  [{i + len(batch)}/{len(diseases)}] embedded")
        except Exception as e:
            print(f"  ⚠ Error at batch {i}: {e}")
            time.sleep(5)

        time.sleep(0.5)  # rate limit

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False)

    print(f"\n✅ Saved {len(results)} embeddings → {OUT_FILE}")
    print("   Run build_index.py next.")


if __name__ == "__main__":
    main()
