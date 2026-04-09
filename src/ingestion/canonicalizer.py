"""
NLP Crime Type Canonicalization
--------------------------------
Embeds all distinct crime_type strings using sentence-transformers,
clusters them with agglomerative clustering, then assigns a clean
canonical name to each cluster based on the shortest, most readable
member. Writes a canonical_map.json lookup and re-tags every record
in crime.json with a `canonical_type` field.

Run: python3 src/ingestion/canonicalizer.py
"""

import json
import re
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

CRIME_JSON = "data/processed/crime.json"
CANONICAL_MAP = "data/processed/canonical_map.json"

# ── helpers ────────────────────────────────────────────────────────────────────

def clean_for_display(text: str) -> str:
    """Strip legal section numbers and formatting noise for a readable label."""
    t = text
    # Remove section references  e.g.  u/s 376 IPC  /  (Sec. 64 BNS)
    t = re.sub(r"u/s\s+[\d\-A-Z\s\(\)&,]+(?:IPC|BNS)", "", t, flags=re.I)
    t = re.sub(r"\(Sec\.?[^)]+\)", "", t, flags=re.I)
    t = re.sub(r"\bIPC\b|\bBNS\b", "", t, flags=re.I)
    # Remove leading ordinal markers  (i)  (ii)  (a)  (b)
    t = re.sub(r"^\s*\([a-z]+\)\s*", "", t)
    # Collapse punctuation
    t = re.sub(r"[\-_/\.]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip().title()
    return t


def pick_canonical_label(members: list[str]) -> str:
    """
    From a cluster of raw crime_type strings choose the best label:
    prefer the shortest cleaned string that still has meaningful words.
    """
    cleaned = [(clean_for_display(m), m) for m in members]
    # Sort by: fewer words is cleaner, but must be > 2 chars
    cleaned = [(c, r) for c, r in cleaned if len(c) > 2]
    if not cleaned:
        return clean_for_display(members[0])
    cleaned.sort(key=lambda x: len(x[0].split()))
    return cleaned[0][0]


# ── main ───────────────────────────────────────────────────────────────────────

def build_canonical_map():
    with open(CRIME_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Collect all distinct non-total crime_type strings
    all_types = sorted({
        r["crime_type"].strip()
        for entry in data
        for r in entry["records"]
        if not r.get("is_total") and r["crime_type"].strip()
    })
    print(f"Distinct crime types to embed: {len(all_types)}")

    # ── Embed ──────────────────────────────────────────────────────────────────
    print("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(all_types, show_progress_bar=True, normalize_embeddings=True)
    print(f"Embeddings shape: {embeddings.shape}")

    # ── Cluster ────────────────────────────────────────────────────────────────
    # Distance threshold tuned to merge whitespace/section-number variants
    # while keeping genuinely distinct crimes separate.
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=0.35,   # cosine distance (1 - cosine_sim)
        metric="cosine",
        linkage="average",
    )
    labels = clustering.fit_predict(embeddings)
    n_clusters = labels.max() + 1
    print(f"Formed {n_clusters} canonical clusters from {len(all_types)} strings")

    # ── Build map ──────────────────────────────────────────────────────────────
    clusters: dict[int, list[str]] = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(all_types[idx])

    canonical_map: dict[str, str] = {}
    cluster_summary = []
    for label, members in sorted(clusters.items()):
        canon = pick_canonical_label(members)
        for m in members:
            canonical_map[m] = canon
        cluster_summary.append({"canonical": canon, "members": members, "size": len(members)})

    # Log clusters that merged more than one entry — those are the interesting ones
    merged = [c for c in cluster_summary if c["size"] > 1]
    print(f"\nMerged clusters ({len(merged)}):")
    for c in sorted(merged, key=lambda x: -x["size"])[:20]:
        print(f"  [{c['size']}] '{c['canonical']}'")
        for m in c["members"]:
            print(f"        <- {repr(m)}")

    with open(CANONICAL_MAP, "w", encoding="utf-8") as f:
        json.dump(canonical_map, f, indent=2, ensure_ascii=False)
    print(f"\nCanonical map saved: {CANONICAL_MAP} ({len(canonical_map)} entries)")

    return canonical_map


def apply_canonical_map(canonical_map: dict[str, str]):
    """Tag every record in crime.json with canonical_type."""
    with open(CRIME_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    tagged = 0
    for entry in data:
        for r in entry["records"]:
            raw = r["crime_type"].strip()
            r["canonical_type"] = canonical_map.get(raw, clean_for_display(raw))
            tagged += 1

    with open(CRIME_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Tagged {tagged} records with canonical_type → {CRIME_JSON}")


if __name__ == "__main__":
    canonical_map = build_canonical_map()
    apply_canonical_map(canonical_map)
    print("\nCanonicalization complete.")
