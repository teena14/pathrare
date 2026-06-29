"""
build_hpo_index.py
──────────────────
Builds a Gemini vector index for PathRare's diagnostic engine.

For each Orphanet disease that has HPO annotations, this script creates a
rich text description combining the disease name, classification type, and
all known HPO phenotype terms. It then embeds that description using Gemini
text-embedding-004 and saves the result to data/orphanet/parsed/index.json.

The index is used at runtime in /api/diagnose for semantic vector search —
the patient's symptom text is embedded on-the-fly and compared against the
index using cosine similarity.

Input files:
  data/orphanet/parsed/alignments.json      (disease names + ICD/OMIM codes)
  data/orphanet/parsed/classifications.json  (disease types)
  data/hpo/phenotype.hpoa                   (disease → HPO annotations)
  data/hpo/hp.obo                           (HPO term names)

Output:
  data/orphanet/parsed/index.json

Prerequisites:
  pip install python-dotenv
  GEMINI_API_KEY must be set in your environment (or .env.local)
"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from collections import defaultdict

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
except ImportError:
    pass

# ── Paths ──────────────────────────────────────────────────────────────────────
ALIGNMENTS   = Path("data/orphanet/parsed/alignments.json")
CLASSIFS     = Path("data/orphanet/parsed/classifications.json")
HPOA_FILE    = Path("data/hpo/phenotype.hpoa")
OBO_FILE     = Path("data/hpo/hp.obo")
OUT_FILE     = Path("data/orphanet/parsed/index.json")

# ── Config ─────────────────────────────────────────────────────────────────────
BATCH_SIZE   = 50    
RATE_DELAY   = 1.0   
MIN_HPO_TERMS = 2    
SAVE_EVERY   = 200   

def parse_obo_names(obo_path: Path) -> dict[str, str]:
    """Parse hp.obo → {HP:XXXXXXX: term_name}"""
    terms = {}
    current_id = None
    current_name = None
    for line in obo_path.read_text(encoding="utf-8").splitlines():
        if line == "[Term]":
            current_id = current_name = None
        elif line.startswith("id: HP:"):
            current_id = line[4:].strip()
        elif line.startswith("name: ") and current_id:
            current_name = line[6:].strip()
            if current_id and current_name:
                terms[current_id] = current_name
    return terms


def parse_hpoa(hpoa_path: Path) -> dict[str, list[str]]:
    """Parse phenotype.hpoa → {ORPHA:XXXXXX: [HP:codes]}"""
    disease_hpo: dict[str, list[str]] = defaultdict(list)
    for line in hpoa_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 11:
            continue
        db_id, qualifier, hpo_id, aspect = parts[0], parts[2], parts[3], parts[10]
        if qualifier == "NOT" or aspect != "P" or not hpo_id.startswith("HP:"):
            continue
        if db_id.startswith("ORPHA:"):
            disease_hpo[db_id].append(hpo_id)
    return dict(disease_hpo)


def build_disease_text(name: str, disease_type: str, hpo_names: list[str]) -> str:
    parts = [f"Rare disease: {name}."]
    if disease_type and disease_type not in ("Disease", ""):
        parts.append(f"Classification: {disease_type}.")
    if hpo_names:
        parts.append(f"Key clinical features include: {', '.join(hpo_names[:30])}.")
        if len(hpo_names) > 30:
            parts.append(f"Additional features: {', '.join(hpo_names[30:60])}.")
    return " ".join(parts)


def embed_batch(api_key: str, texts: list[str]) -> list[list[float]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
    results = []
    
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

    print("PathRare — HPO-Enriched Gemini Index Builder")
    print("=" * 55)
    print("  Using Gemini API (Google AI Studio)")
    print()

    # ── Load HPO term names ──────────────────────────────────────────────────
    print("📖 Parsing hp.obo...")
    hpo_names = parse_obo_names(OBO_FILE)
    print(f"   {len(hpo_names):,} HPO terms loaded")

    # ── Load disease → HPO annotations ──────────────────────────────────────
    print("📖 Parsing phenotype.hpoa...")
    disease_hpo = parse_hpoa(HPOA_FILE)
    print(f"   {len(disease_hpo):,} ORPHA diseases with HPO annotations")

    # ── Load Orphanet alignments (names) ─────────────────────────────────────
    print("📖 Loading alignments.json...")
    alignments = {d["orpha_code"]: d["name"] for d in json.loads(ALIGNMENTS.read_text(encoding="utf-8")) if d.get("name")}

    # ── Load classifications (disease types) ─────────────────────────────────
    print("📖 Loading classifications.json...")
    classif_map: dict[str, str] = {}
    for entry in json.loads(CLASSIFS.read_text(encoding="utf-8")):
        if entry.get("orpha_code") and entry.get("type"):
            classif_map[entry["orpha_code"]] = entry["type"]

    # ── Build disease list for embedding ────────────────────────────────────
    diseases_to_embed = []
    for orpha_id_full, hp_codes in disease_hpo.items():
        if not orpha_id_full.startswith("ORPHA:"):
            continue
        orpha_code = orpha_id_full[6:]   # strip "ORPHA:"
        name = alignments.get(orpha_code)
        if not name:
            continue
        if len(hp_codes) < MIN_HPO_TERMS:
            continue
        term_names = [hpo_names[hp] for hp in hp_codes if hp in hpo_names]
        disease_type = classif_map.get(orpha_code, "")
        text = build_disease_text(name, disease_type, term_names)
        diseases_to_embed.append({
            "orpha_code": orpha_code,
            "name": name,
            "text": text,
        })

    print(f"\n🧬 {len(diseases_to_embed):,} diseases selected for embedding (≥{MIN_HPO_TERMS} HPO terms)")
    print()

    # ── Load existing partial results (resume support) ───────────────────────
    results: list[dict] = []
    done_codes: set[str] = set()
    if OUT_FILE.exists():
        existing = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        if isinstance(existing, list) and existing:
            results = existing
            done_codes = {r["orpha_code"] for r in results}
            print(f"♻️  Resuming — {len(done_codes):,} already embedded, {len(diseases_to_embed) - len(done_codes):,} remaining")

    pending = [d for d in diseases_to_embed if d["orpha_code"] not in done_codes]

    # ── Embed in batches ─────────────────────────────────────────────────────
    errors = 0
    for i in range(0, len(pending), BATCH_SIZE):
        batch = pending[i: i + BATCH_SIZE]
        texts = [d["text"] for d in batch]
        try:
            embeddings = embed_batch(api_key, texts)
            for disease, emb in zip(batch, embeddings):
                if emb:
                    results.append({
                        "orpha_code": disease["orpha_code"],
                        "name": disease["name"],
                        "embedding": emb,
                    })
            done = i + len(batch)
            pct = done / len(pending) * 100
            print(f"  [{done:>5}/{len(pending)}] {pct:5.1f}%  — last: {batch[-1]['name'][:50]}")
        except urllib.error.HTTPError as e:
            print(f"  ⚠ HTTP Error at batch {i}: {e.code} {e.reason}")
            errors += 1
            time.sleep(10)
            continue
        except Exception as e:
            print(f"  ⚠ Error at batch {i}: {e}")
            errors += 1
            time.sleep(10)
            continue

        # Save partial results
        if len(results) % SAVE_EVERY == 0:
            OUT_FILE.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")
            print(f"  💾 Checkpoint saved ({len(results):,} entries)")

        time.sleep(RATE_DELAY)

    # ── Final save ───────────────────────────────────────────────────────────
    OUT_FILE.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")

    size_mb = OUT_FILE.stat().st_size / 1024 / 1024
    print(f"\n✅ Done! {len(results):,} disease embeddings saved → {OUT_FILE}")
    print(f"   File size: {size_mb:.1f} MB")
    print(f"   Errors: {errors}")
    print()
    print("▶ Restart your Next.js dev server — /api/diagnose will now use vector search.")

if __name__ == "__main__":
    main()

