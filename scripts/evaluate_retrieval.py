"""Measure retrieval recall, reciprocal rank, rejection accuracy, and latency."""

import json
import statistics
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.rag import RAGEngine, normalize_text  # noqa: E402
from config import settings  # noqa: E402


def main() -> int:
    cases = json.loads((ROOT / "evaluation" / "questions.json").read_text(encoding="utf-8"))
    engine = RAGEngine(settings.data_dir)
    reciprocal_ranks: list[float] = []
    supported_hits = 0
    rejection_hits = 0
    latencies: list[float] = []

    for case in cases:
        started = time.perf_counter()
        results = engine.search(case["query"])
        latencies.append((time.perf_counter() - started) * 1000)
        if case["supported"]:
            expected = [normalize_text(term) for term in case["expected_terms"]]
            matching_rank = next(
                (
                    rank
                    for rank, result in enumerate(results, start=1)
                    if any(term in normalize_text(result.chunk.content) for term in expected)
                ),
                None,
            )
            supported_hits += matching_rank is not None
            reciprocal_ranks.append(1 / matching_rank if matching_rank else 0.0)
        else:
            rejection_hits += not results

    supported_count = sum(case["supported"] for case in cases)
    unsupported_count = len(cases) - supported_count
    report = {
        "recall_at_k": round(supported_hits / supported_count, 3),
        "mrr": round(statistics.mean(reciprocal_ranks), 3),
        "unsupported_rejection_accuracy": round(rejection_hits / unsupported_count, 3),
        "median_latency_ms": round(statistics.median(latencies), 1),
        "p95_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.95) - 1], 1),
        "cases": len(cases),
    }
    print(json.dumps(report, indent=2))
    return 0 if report["recall_at_k"] >= 0.8 else 1


if __name__ == "__main__":
    raise SystemExit(main())
