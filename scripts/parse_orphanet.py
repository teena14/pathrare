"""
parse_orphanet.py
-----------------
Parses Orphanet XML files and outputs clean JSON for the PathRare diagnostic layer.

Supported XML types:
  - en_product4_HPO.xml   → disease-symptom mappings (PRIMARY)
  - en_product3.xml       → disease classifications/hierarchy
  - en_product7.xml       → ICD / OMIM / MeSH alignments

Usage:
  python scripts/parse_orphanet.py

Output:
  data/orphanet/parsed/diseases.json
  data/orphanet/parsed/classifications.json
  data/orphanet/parsed/alignments.json
"""

import os
import json
import glob
import xml.etree.ElementTree as ET
from pathlib import Path

XML_DIR = Path("data/orphanet/xml")
OUT_DIR = Path("data/orphanet/parsed")
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

def text(node, tag, default=""):
    el = node.find(tag)
    return el.text.strip() if el is not None and el.text else default


def find_xml(pattern):
    """Find XML files matching a glob pattern in XML_DIR."""
    return glob.glob(str(XML_DIR / pattern))


# ── Parser 1: Disease → HPO symptom mappings (en_product4_HPO.xml) ────────────

def parse_hpo(filepath):
    print(f"  Parsing HPO file: {filepath}")
    tree = ET.parse(filepath)
    root = tree.getroot()

    diseases = []
    for disorder in root.iter("Disorder"):
        orpha_code = text(disorder, "OrphaCode")
        name_el = disorder.find("Name[@lang='en']")
        if name_el is None:
            name_el = disorder.find("Name")
        name = name_el.text.strip() if name_el is not None and name_el.text else ""

        symptoms = []
        for assoc in disorder.findall(".//HPODisorderAssociation"):
            hpo_id_el = assoc.find(".//HPOId")
            hpo_term_el = assoc.find(".//HPOTerm")
            freq_el = assoc.find(".//HPOFrequency/Name[@lang='en']")
            if freq_el is None:
                freq_el = assoc.find(".//HPOFrequency/Name")

            symptoms.append({
                "hpo_id": hpo_id_el.text.strip() if hpo_id_el is not None and hpo_id_el.text else "",
                "term": hpo_term_el.text.strip() if hpo_term_el is not None and hpo_term_el.text else "",
                "frequency": freq_el.text.strip() if freq_el is not None and freq_el.text else "Unknown",
            })

        diseases.append({
            "orpha_code": orpha_code,
            "name": name,
            "symptoms": symptoms,
            "symptom_text": " ".join([s["term"] for s in symptoms]),  # for embedding
        })

    return diseases


# ── Parser 2: Classifications (en_product3.xml) ────────────────────────────────

def parse_classifications(filepath):
    print(f"  Parsing classifications file: {filepath}")
    tree = ET.parse(filepath)
    root = tree.getroot()

    classifications = []
    for disorder in root.iter("Disorder"):
        orpha_code = text(disorder, "OrphaCode")
        name_el = disorder.find("Name[@lang='en']")
        if name_el is None:
            name_el = disorder.find("Name")
        name = name_el.text.strip() if name_el is not None and name_el.text else ""

        disorder_type_el = disorder.find(".//DisorderType/Name[@lang='en']")
        if disorder_type_el is None:
            disorder_type_el = disorder.find(".//DisorderType/Name")

        parent_el = disorder.find(".//ClassificationNode/..")
        classifications.append({
            "orpha_code": orpha_code,
            "name": name,
            "type": disorder_type_el.text.strip() if disorder_type_el is not None and disorder_type_el.text else "",
        })

    return classifications


# ── Parser 3: Alignments / ICD-OMIM (en_product7.xml) ─────────────────────────

def parse_alignments(filepath):
    print(f"  Parsing alignments file: {filepath}")
    tree = ET.parse(filepath)
    root = tree.getroot()

    alignments = []
    for disorder in root.iter("Disorder"):
        orpha_code = text(disorder, "OrphaCode")
        name_el = disorder.find("Name[@lang='en']")
        if name_el is None:
            name_el = disorder.find("Name")
        name = name_el.text.strip() if name_el is not None and name_el.text else ""

        icd_codes = []
        omim_refs = []

        for ext_ref in disorder.findall(".//ExternalReference"):
            source_el = ext_ref.find("Source")
            ref_el = ext_ref.find("Reference")
            if source_el is None or ref_el is None:
                continue
            source = source_el.text.strip() if source_el.text else ""
            ref = ref_el.text.strip() if ref_el.text else ""

            if "ICD" in source:
                icd_codes.append(ref)
            elif source == "OMIM":
                omim_refs.append(ref)

        alignments.append({
            "orpha_code": orpha_code,
            "name": name,
            "icd_codes": icd_codes,
            "omim": omim_refs,
        })

    return alignments


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("PathRare — Orphanet XML Parser")
    print("=" * 40)

    # 1. HPO disease-symptom mappings
    hpo_files = find_xml("*HPO*") or find_xml("*product4*") or find_xml("*hpo*") or find_xml("*phenotype*")
    all_diseases = []
    for f in hpo_files:
        all_diseases.extend(parse_hpo(f))

    out_path = OUT_DIR / "diseases.json"
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(all_diseases, fp, ensure_ascii=False, indent=2)
    print(f"  ✓ Saved {len(all_diseases)} diseases → {out_path}")

    # 2. Classifications
    class_files = find_xml("*product3*") or find_xml("*classif*")
    all_classifications = []
    for f in class_files:
        all_classifications.extend(parse_classifications(f))

    out_path = OUT_DIR / "classifications.json"
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(all_classifications, fp, ensure_ascii=False, indent=2)
    print(f"  ✓ Saved {len(all_classifications)} classifications → {out_path}")

    # 3. Alignments (ICD / OMIM)
    align_files = find_xml("*product7*") or find_xml("*align*")
    all_alignments = []
    for f in align_files:
        all_alignments.extend(parse_alignments(f))

    out_path = OUT_DIR / "alignments.json"
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(all_alignments, fp, ensure_ascii=False, indent=2)
    print(f"  ✓ Saved {len(all_alignments)} alignments → {out_path}")

    print("\n✅ Parsing complete. Run embed_symptoms.py next.")


if __name__ == "__main__":
    main()
