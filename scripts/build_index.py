"""Rebuild the FAISS index from chunks.json using the configured embedding model."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import settings  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kb-dir", type=Path, default=settings.data_dir / "kb")
    parser.add_argument("--model", default=settings.embedding_model)
    args = parser.parse_args()

    chunks_path = args.kb_dir / "chunks.json"
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
    if not chunks or any("content" not in chunk for chunk in chunks):
        raise ValueError("chunks.json must contain non-empty objects with a content field")

    model = SentenceTransformer(args.model)
    embeddings = model.encode(
        [f"passage: {chunk['content']}" for chunk in chunks],
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32)
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    temporary_index = args.kb_dir / "index.faiss.tmp"
    faiss.write_index(index, str(temporary_index))
    temporary_index.replace(args.kb_dir / "index.faiss")
    metadata = {
        "embedding_model": args.model,
        "embedding_dim": embeddings.shape[1],
        "total_chunks": len(chunks),
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    (args.kb_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    print(f"Indexed {len(chunks)} chunks with {args.model}")


if __name__ == "__main__":
    main()
