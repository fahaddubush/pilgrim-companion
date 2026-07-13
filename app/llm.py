"""Local Ollama and OpenAI-compatible API language-model clients."""

from __future__ import annotations

import json
from typing import Iterator, Protocol

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import settings


class LLMClient(Protocol):
    model_name: str
    provider_name: str

    def generate(self, prompt: str) -> str: ...

    def generate_stream(self, prompt: str) -> Iterator[str]: ...

    def warmup(self) -> bool: ...

    def close(self) -> None: ...


def create_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        connect=0,
        read=0,
        status=3,
        backoff_factor=0.2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods={"GET", "POST"},
    )
    session.mount(
        "http://",
        HTTPAdapter(pool_connections=10, pool_maxsize=20, max_retries=retry),
    )
    session.mount(
        "https://",
        HTTPAdapter(pool_connections=10, pool_maxsize=20, max_retries=retry),
    )
    return session


class OllamaClient:
    provider_name = "ollama"

    def __init__(self, model_name: str, base_url: str) -> None:
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.session = create_session()
        try:
            response = self.session.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
            models = [model["name"] for model in response.json().get("models", [])]
        except requests.RequestException as exc:
            raise RuntimeError("Ollama is unavailable. Start it with 'ollama serve'.") from exc
        if model_name not in models:
            raise RuntimeError(
                f"Ollama model '{model_name}' is not installed. Run: ollama pull {model_name}"
            )

    @staticmethod
    def _options() -> dict:
        return {
            "num_predict": settings.max_tokens,
            "temperature": settings.temperature,
            "top_p": settings.top_p,
            "stop": ["User:", "Assistant:"],
        }

    def generate(self, prompt: str) -> str:
        response = self.session.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": self._options(),
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json().get("response", "").strip()

    def generate_stream(self, prompt: str) -> Iterator[str]:
        with self.session.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model_name,
                "prompt": prompt,
                "stream": True,
                "options": self._options(),
            },
            timeout=120,
            stream=True,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                event = json.loads(line)
                if token := event.get("response"):
                    yield token
                if event.get("done"):
                    return

    def warmup(self) -> bool:
        try:
            return self.session.get(f"{self.base_url}/api/tags", timeout=2).ok
        except requests.RequestException:
            return False

    def close(self) -> None:
        self.session.close()


class APIClient:
    """Client for APIs implementing the OpenAI-compatible chat-completions format."""

    provider_name = "api"

    def __init__(self, model_name: str, base_url: str, api_key: str) -> None:
        if not model_name or not base_url or not api_key:
            raise RuntimeError(
                "API mode requires API_MODEL, API_BASE_URL, and API_KEY in the environment."
            )
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.session = create_session()
        self.session.headers.update(
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )

    def _payload(self, prompt: str, stream: bool) -> dict:
        return {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature,
            "top_p": settings.top_p,
            "stream": stream,
        }

    def generate(self, prompt: str) -> str:
        response = self.session.post(
            f"{self.base_url}/chat/completions",
            json=self._payload(prompt, False),
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    def generate_stream(self, prompt: str) -> Iterator[str]:
        with self.session.post(
            f"{self.base_url}/chat/completions",
            json=self._payload(prompt, True),
            timeout=120,
            stream=True,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    return
                event = json.loads(data)
                if token := event.get("choices", [{}])[0].get("delta", {}).get("content"):
                    yield token

    def warmup(self) -> bool:
        try:
            return self.session.get(f"{self.base_url}/models", timeout=5).ok
        except requests.RequestException:
            return False

    def close(self) -> None:
        self.session.close()


def load_llm_from_env() -> LLMClient:
    if settings.llm_provider == "ollama":
        return OllamaClient(settings.ollama_model, settings.ollama_base_url)
    if settings.llm_provider == "api":
        return APIClient(settings.api_model, settings.api_base_url, settings.api_key)
    raise RuntimeError("LLM_PROVIDER must be either 'ollama' or 'api'.")
