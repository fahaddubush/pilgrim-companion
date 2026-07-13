"""Audit knowledge-base provenance, duplication, and index consistency."""

import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import faiss


ROOT = Path(__file__).resolve().parents[1]
KB_DIR = ROOT / "data" / "kb"


def main() -> int:
    chunks = json.loads((KB_DIR / "chunks.json").read_text(encoding="utf-8"))
    metadata = json.loads((KB_DIR / "metadata.json").read_text(encoding="utf-8"))
    index = faiss.read_index(str(KB_DIR / "index.faiss"))
    normalized = [" ".join(chunk["content"].lower().split()) for chunk in chunks]
    duplicates = len(normalized) - len(set(normalized))
    missing_urls = sum(not chunk.get("url") for chunk in chunks)
    domains = Counter(
        urlparse(chunk.get("url", "")).netloc or "missing"
        for chunk in chunks
    )
    report = {
        "chunks": len(chunks),
        "index_vectors": index.ntotal,
        "index_dimension": index.d,
        "metadata_dimension": metadata.get("embedding_dim"),
        "exact_duplicate_chunks": duplicates,
        "missing_urls": missing_urls,
        "sources": len({chunk.get("source") for chunk in chunks}),
        "domains": domains,
        "built_at": metadata.get("built_at"),
    }
    print(json.dumps(report, indent=2, default=dict))
    valid = (
        index.ntotal == len(chunks)
        and index.d == metadata.get("embedding_dim")
        and duplicates == 0
    )
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
