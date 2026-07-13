"""Environment-backed application settings."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    data_dir: Path = BASE_DIR / "data"
    static_dir: Path = BASE_DIR / "static"
    templates_dir: Path = BASE_DIR / "templates"

    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama").lower()
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    api_model: str = os.getenv("API_MODEL", "")
    api_base_url: str = os.getenv("API_BASE_URL", "")
    api_key: str = os.getenv("API_KEY", "")
    max_tokens: int = int(os.getenv("MAX_TOKENS", "256"))
    temperature: float = float(os.getenv("TEMPERATURE", "0.2"))
    top_p: float = float(os.getenv("TOP_P", "0.9"))

    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL", "intfloat/multilingual-e5-small"
    )
    retrieval_candidates: int = int(os.getenv("RETRIEVAL_CANDIDATES", "12"))
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "4"))
    minimum_dense_score: float = float(os.getenv("MINIMUM_DENSE_SCORE", "0.42"))
    semantic_cache_threshold: float = float(
        os.getenv("SEMANTIC_CACHE_THRESHOLD", "0.92")
    )
    query_cache_size: int = int(os.getenv("QUERY_CACHE_SIZE", "128"))
    response_cache_size: int = int(os.getenv("RESPONSE_CACHE_SIZE", "64"))
    reranker_enabled: bool = _bool("RERANKER_ENABLED")
    reranker_model: str = os.getenv(
        "RERANKER_MODEL", "BAAI/bge-reranker-v2-m3"
    )

    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    reload: bool = _bool("RELOAD")


settings = Settings()
