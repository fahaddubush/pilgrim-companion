# RAG design

## Objective and constraints

Pilgrim Companion answers Hajj and Umrah questions from a small, curated corpus. Accuracy,
provenance, refusal when evidence is weak, Arabic/English retrieval, local operation, and low
latency matter more than open-domain coverage. Religious rulings and changing operational rules
must remain attributable to qualified or official sources.

## Selected pipeline

1. Normalize English and Arabic text and expand a small set of ritual terms.
2. Retrieve 12 candidates independently with multilingual E5 dense vectors and BM25 lexical search.
3. Fuse rankings with weighted Reciprocal Rank Fusion (RRF).
4. Reject weak dense-only matches, remove adjacent duplicate chunks, and limit source repetition.
5. Optionally rerank the small candidate set with `BAAI/bge-reranker-v2-m3`.
6. Generate from delimited evidence, require inline `[S1]` citations, and refuse unsupported answers.
7. Cache only standalone questions; conversational follow-ups are never semantically cached.

This is deliberately a two-stage, corrective pipeline. It catches poor retrieval before generation
without introducing uncontrolled live web content.

## Why these techniques

- Hybrid retrieval preserves semantic matching while recovering exact ritual names, transliterations,
  and Arabic terms. RRF is simple and does not require score calibration across retrievers. The
  original RRF study found robust gains from combining independent rankings:
  [Cormack et al.](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf).
- Retrieve-then-rerank improves precision because a cross-encoder jointly attends to the query and
  passage, but it is slower. It is optional here to preserve laptop performance:
  [Sentence Transformers documentation](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html).
- Corrective RAG motivates evaluating retrieval and changing behavior when evidence is poor instead
  of always generating: [Yan et al., 2024](https://arxiv.org/abs/2401.15884).
- BGE-M3 is a compelling future single-model multilingual dense+sparse option, but it is much heavier
  than E5-small and is unnecessary until evaluation proves a gain:
  [Chen et al., 2024](https://arxiv.org/abs/2402.03216).
- Late chunking retains document context and is worth testing when the original full documents and a
  long-context embedder are available: [Günther et al., 2024](https://arxiv.org/abs/2409.04701).
- RAG evaluation must separate retrieval quality, evidence use, and answer faithfulness:
  [RAGAS](https://arxiv.org/abs/2309.15217) and
  [RAGChecker](https://arxiv.org/abs/2408.08067).

## Techniques intentionally not used

- **GraphRAG:** the corpus is small and procedural rather than relationship-heavy. Graph extraction
  adds latency and another source of errors without a demonstrated retrieval need.
- **ColBERT/late interaction:** stronger token-level matching can help large collections, but the
  index and runtime complexity are disproportionate for 123 chunks. ColBERTv2 is documented in
  [Santhanam et al.](https://arxiv.org/abs/2112.01488).
- **Automatic live-web corrective retrieval:** current Hajj logistics do change, but injecting arbitrary
  web results is unsafe for religious and operational guidance. A controlled ingestion job restricted
  to Ministry/Nusuk sources, with review and timestamped provenance, is the safer next step.

## Evaluation and freshness

Run:

```powershell
python scripts/audit_kb.py
python scripts/evaluate_retrieval.py
```

The evaluation reports Recall@K, mean reciprocal rank, unsupported-query rejection, and latency.
Expand `evaluation/questions.json` with scholar-reviewed English and Arabic examples before making
claims about production accuracy.

The current index is static. For current operational guidance, add a reviewed ingestion process that:

1. fetches only allow-listed official pages;
2. records `retrieved_at`, `last_verified_at`, URL, title, and content hash;
3. shows stale-source warnings;
4. requires review before atomically replacing the index;
5. runs the retrieval evaluation as a release gate.
