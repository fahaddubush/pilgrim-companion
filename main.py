"""FastAPI entry point for Pilgrim Companion."""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading
from contextlib import asynccontextmanager
from typing import Literal, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from app.llm import APIClient, LLMClient, OllamaClient, load_llm_from_env
from app.rag import RAGEngine, SearchResult, build_prompt, get_confidence_level
from config import settings


logger = logging.getLogger("pilgrim_companion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ModelOptions(BaseModel):
    provider: Literal["ollama", "api"] = "ollama"
    ollama_model: str = Field(default="llama3.2:3b", max_length=200)
    ollama_base_url: str = Field(default="http://localhost:11434", max_length=500)
    api_model: str = Field(default="", max_length=200)
    api_base_url: str = Field(default="", max_length=500)
    api_key: str = Field(default="", max_length=1000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=500)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=20)
    model: ModelOptions = Field(default_factory=ModelOptions)


class SourceContext(BaseModel):
    id: str
    score: float
    dense_score: float
    lexical_score: float
    source: str
    snippet: str
    category: str
    url: str


class ChatResponse(BaseModel):
    reply: str
    contexts: list[SourceContext]
    confidence: str
    confidence_message: str
    llm_model: Optional[str] = None


def sse(event_type: str, **payload) -> str:
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


def history_dicts(request: ChatRequest) -> list[dict]:
    return [message.model_dump() for message in request.history]


def context_dicts(results: list[SearchResult]) -> list[dict]:
    return [result.to_dict() for result in results]


def retrieval_query(payload: ChatRequest) -> str:
    """Resolve short follow-ups with the most recent user turn for retrieval only."""
    previous_user = next(
        (message.content for message in reversed(payload.history) if message.role == "user"),
        "",
    )
    return f"{previous_user} {payload.message}".strip() if previous_user else payload.message


def unsupported_reply(query: str) -> str:
    if any("\u0600" <= character <= "\u06ff" for character in query):
        return (
            "لا أملك معلومات موثوقة كافية للإجابة عن هذا السؤال من قاعدة المعرفة الحالية. "
            "يرجى الرجوع إلى منصة نسك أو وزارة الحج والعمرة أو سؤال عالم مؤهل."
        )
    return (
        "I do not have enough verified information in the current knowledge base to answer that. "
        "Please check Nusuk or the Ministry of Hajj and Umrah, or consult a qualified scholar."
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.rag = None
    app.state.rag_status = None
    app.state.llm = None
    app.state.llm_status = None
    try:
        app.state.rag = await asyncio.to_thread(RAGEngine, settings.data_dir)
        logger.info("Knowledge base ready: %s", app.state.rag.stats())
    except Exception as exc:
        app.state.rag_status = str(exc)
        logger.exception("Knowledge base failed to initialize")
    try:
        app.state.llm = await asyncio.to_thread(load_llm_from_env)
    except RuntimeError as exc:
        app.state.llm_status = str(exc)
        logger.warning("LLM unavailable: %s", exc)
    yield
    if app.state.llm:
        app.state.llm.close()


app = FastAPI(title="Pilgrim Companion", version="1.0.0", lifespan=lifespan)
templates = Jinja2Templates(directory=str(settings.templates_dir))
app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")


def rag_service(request: Request) -> RAGEngine:
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail=request.app.state.rag_status or "RAG unavailable")
    return rag


def validate_model_options(options: ModelOptions) -> None:
    if options.provider != "api":
        return
    if not options.api_model or not options.api_base_url or not options.api_key:
        raise ValueError("API provider requires a base URL, model, and API key")
    parsed = urlparse(options.api_base_url)
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (
        parsed.scheme == "http" and parsed.hostname in local_hosts
    ):
        raise ValueError("API base URL must use HTTPS (HTTP is allowed only for localhost)")


def resolve_llm(options: ModelOptions, request: Request) -> tuple[LLMClient, bool]:
    configured = request.app.state.llm
    try:
        if options.provider == "api":
            validate_model_options(options)
            return APIClient(options.api_model, options.api_base_url, options.api_key), True
        if (
            configured
            and configured.provider_name == "ollama"
            and configured.model_name == options.ollama_model
        ):
            return configured, False
        return OllamaClient(options.ollama_model, options.ollama_base_url), True
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/health")
async def health(request: Request):
    rag_ready = request.app.state.rag is not None
    llm_ready = request.app.state.llm is not None
    return {
        "status": "ok" if rag_ready and llm_ready else "degraded",
        "rag_ready": rag_ready,
        "rag_status": request.app.state.rag_status,
        "llm_ready": llm_ready,
        "llm_status": request.app.state.llm_status,
        "llm_provider": request.app.state.llm.provider_name if llm_ready else settings.llm_provider,
        "llm_model": request.app.state.llm.model_name if llm_ready else None,
    }


@app.get("/api/stats")
async def stats(request: Request):
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail=request.app.state.rag_status or "RAG unavailable")
    return {"knowledge_base": rag.stats(), "cache": rag.cache_stats()}


@app.post("/api/warmup")
async def warmup(request: Request):
    rag = rag_service(request)
    llm = request.app.state.llm
    if not llm:
        raise HTTPException(status_code=503, detail=request.app.state.llm_status or "LLM unavailable")
    return {
        "warmed": await asyncio.to_thread(llm.warmup),
        "cache": rag.cache_stats(),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request):
    rag = rag_service(request)
    results = await asyncio.to_thread(rag.search, retrieval_query(payload))
    confidence, confidence_message = get_confidence_level(results)
    llm_model = None
    if results:
        prompt = build_prompt(payload.message, history_dicts(payload), results)
        llm, owned = resolve_llm(payload.model, request)
        llm_model = llm.model_name
        try:
            reply = await asyncio.to_thread(llm.generate, prompt)
        finally:
            if owned:
                llm.close()
    else:
        reply = unsupported_reply(payload.message)
    return ChatResponse(
        reply=reply,
        contexts=context_dicts(results),
        confidence=confidence,
        confidence_message=confidence_message,
        llm_model=llm_model,
    )


@app.post("/api/chat/stream")
async def chat_stream(payload: ChatRequest, request: Request):
    rag = rag_service(request)

    # Follow-up questions depend on history and must never reuse a context-free response.
    cached = None if payload.history or payload.model.provider == "api" else await asyncio.to_thread(
        rag.check_semantic_cache, payload.message
    )
    if cached:
        async def cached_events():
            yield sse(
                "contexts",
                contexts=cached.contexts,
                confidence=cached.confidence,
                confidence_message=cached.confidence_message,
                cached=True,
            )
            yield sse("token", token=cached.response)
            yield sse("done")

        return StreamingResponse(cached_events(), media_type="text/event-stream", headers=sse_headers())

    results = await asyncio.to_thread(rag.search, retrieval_query(payload))
    contexts = context_dicts(results)
    confidence, confidence_message = get_confidence_level(results)
    prompt = build_prompt(payload.message, history_dicts(payload), results)
    llm = None
    owned = False
    if results:
        llm, owned = resolve_llm(payload.model, request)

    async def events():
        yield sse(
            "contexts",
            contexts=contexts,
            confidence=confidence,
            confidence_message=confidence_message,
            cached=False,
        )
        if not results:
            yield sse("token", token=unsupported_reply(payload.message))
            yield sse("done")
            return
        token_queue: queue.Queue[tuple[str, Optional[str]]] = queue.Queue()

        def produce() -> None:
            try:
                for token in llm.generate_stream(prompt):
                    token_queue.put(("token", token))
                token_queue.put(("done", None))
            except Exception as exc:
                logger.exception("Selected model provider failed while streaming")
                token_queue.put(("error", str(exc)))

        threading.Thread(target=produce, daemon=True).start()
        response_parts: list[str] = []
        completed = False
        try:
            while not await request.is_disconnected():
                try:
                    event_type, value = await asyncio.to_thread(token_queue.get, True, 1)
                except queue.Empty:
                    continue
                if event_type == "token" and value is not None:
                    response_parts.append(value)
                    yield sse("token", token=value)
                elif event_type == "error":
                    yield sse("error", message="The selected model stopped unexpectedly. Please retry.")
                    return
                else:
                    completed = True
                    break

            if completed and response_parts:
                response = "".join(response_parts)
                if not payload.history and payload.model.provider == "ollama":
                    await asyncio.to_thread(
                        rag.add_to_response_cache,
                        payload.message,
                        response,
                        contexts,
                        confidence,
                        confidence_message,
                    )
                yield sse("done")
        finally:
            if owned and llm:
                llm.close()

    return StreamingResponse(events(), media_type="text/event-stream", headers=sse_headers())


def sse_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
