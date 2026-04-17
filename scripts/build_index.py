"""
build_index.py
--------------
Builds a cosine-similarity index from the pre-computed embeddings.
Saves a lightweight index JSON that the Next.js API route can load at startup.

Reads:   data/orphanet/parsed/embeddings.json
Writes:  data/orphanet/parsed/index.json   (metadata + vectors, ready to query)

No FAISS needed — uses pure numpy for portability.

Prerequisites:
  pip install numpy
"""

import json
import numpy as np
from pathlib import Path

EMBEDDINGS_FILE = Path("data/orphanet/parsed/embeddings.json")
INDEX_FILE = Path("data/orphanet/parsed/index.json")


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def main():
    print("PathRare — Index Builder")
    print("=" * 40)

    with open(EMBEDDINGS_FILE, encoding="utf-8") as f:
        embeddings = json.load(f)

    # Normalize all vectors for fast dot-product cosine similarity
    index = []
    for entry in embeddings:
        vec = np.array(entry["embedding"], dtype=np.float32)
        norm = np.linalg.norm(vec)
        index.append({
            "orpha_code": entry["orpha_code"],
            "name": entry["name"],
            "embedding": (vec / norm).tolist(),  # normalized
        })

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    print(f"✅ Index built: {len(index)} diseases → {INDEX_FILE}")
    print("   The Next.js /api/diagnose route will load this file at startup.")


if __name__ == "__main__":
    main()
