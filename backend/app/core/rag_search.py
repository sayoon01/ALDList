"""RAG 검색 유틸리티 (ChromaDB + Ollama embedding)."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

try:
    import chromadb
except ImportError:  # pragma: no cover
    chromadb = None


PROJECT_ROOT = Path(__file__).resolve().parents[3]
CHROMA_PERSIST_DIR = PROJECT_ROOT / "rag_store" / "chroma"
CHROMA_COLLECTION = os.getenv("RAG_CHROMA_COLLECTION", "aldlist_rag")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "nomic-embed-text")


def embed_text(text: str) -> List[float]:
    """Ollama 임베딩 모델 호출."""
    payload = {"model": OLLAMA_EMBED_MODEL, "prompt": text}
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{OLLAMA_BASE_URL}/api/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
    emb = data.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("Ollama embedding 응답이 비어있습니다.")
    return [float(v) for v in emb]


def _get_collection():
    if chromadb is None:
        raise RuntimeError("chromadb가 설치되지 않았습니다. pip install chromadb")
    client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    return client.get_or_create_collection(name=CHROMA_COLLECTION)


def rag_search(query: str, top_k: int = 5, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Chroma 유사도 검색."""
    collection = _get_collection()
    query_emb = embed_text(query)
    where = filters if filters else None
    res = collection.query(
        query_embeddings=[query_emb],
        n_results=max(1, min(top_k, 20)),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    ids = (res.get("ids") or [[]])[0]
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    results = []
    for i, doc_id in enumerate(ids):
        distance = float(dists[i]) if i < len(dists) and dists[i] is not None else 999.0
        score = 1.0 / (1.0 + max(distance, 0.0))
        md = metas[i] if i < len(metas) and isinstance(metas[i], dict) else {}
        text = docs[i] if i < len(docs) and isinstance(docs[i], str) else ""
        results.append({
            "id": doc_id,
            "score": score,
            "text": text,
            "metadata": md,
            "distance": distance,
        })

    return {"query": query, "results": results}
