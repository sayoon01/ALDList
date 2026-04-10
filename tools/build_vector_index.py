#!/usr/bin/env python3
"""
ChromaDB 벡터 인덱스 전체 재빌드 스크립트.

확정사항:
- 문서 단위: column + group
- 임베딩: Ollama nomic-embed-text
- 벡터 저장소: ChromaDB
- 업데이트: 전체 재빌드
"""
from __future__ import annotations

import json
import os
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
import chromadb

from utils import safe_load_yaml, safe_load_json

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASETS_JSON = PROJECT_ROOT / "metadata" / "datasets.json"
GLOBAL_META = PROJECT_ROOT / "column_meta" / "global_columns.yaml"

CHROMA_DIR = PROJECT_ROOT / "rag_store" / "chroma"
COLLECTION_NAME = os.getenv("RAG_CHROMA_COLLECTION", "aldlist_rag")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("RAG_EMBED_MODEL", "nomic-embed-text")


def embed(text: str) -> List[float]:
    payload = {"model": OLLAMA_MODEL, "prompt": text}
    with httpx.Client(timeout=60.0) as client:
        res = client.post(f"{OLLAMA_BASE_URL}/api/embeddings", json=payload)
        res.raise_for_status()
        j = res.json()
    emb = j.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("임베딩 결과가 비어 있습니다.")
    return [float(v) for v in emb]


def build_column_text(dataset_id: str, col: str, meta: Dict[str, Any]) -> str:
    return "\n".join([
        f"Column name: {col}",
        f"컬럼명: {col}",
        f"Dataset: {dataset_id}",
        "Type: column",
        f"Semantic type: {meta.get('type', 'unknown')}",
        f"Unit: {meta.get('unit', '')}",
        f"Description: {meta.get('desc', '')}",
        f"설명: {meta.get('desc', '')}",
        f"Category: {meta.get('category', '')}",
    ]).strip()


def build_group_text(dataset_id: str, group: str, cols: List[str]) -> str:
    col_str = ", ".join(sorted(cols))
    return "\n".join([
        f"Group name: {group}",
        f"그룹명: {group}",
        f"Dataset: {dataset_id}",
        "Type: group",
        f"This group contains columns: {col_str}",
        f"이 그룹은 다음 컬럼을 포함합니다: {col_str}",
    ]).strip()


def build_documents() -> Tuple[List[str], List[str], List[Dict[str, Any]]]:
    datasets = safe_load_json(DATASETS_JSON) or []
    if not isinstance(datasets, list):
        raise RuntimeError("datasets.json 형식이 올바르지 않습니다.")
    meta_map = safe_load_yaml(GLOBAL_META) or {}
    if not isinstance(meta_map, dict):
        raise RuntimeError("global_columns.yaml 형식이 올바르지 않습니다.")

    ids: List[str] = []
    docs: List[str] = []
    metadatas: List[Dict[str, Any]] = []

    for ds in datasets:
        if not isinstance(ds, dict):
            continue
        dataset_id = str(ds.get("dataset_id", "")).strip()
        columns = ds.get("columns") or []
        if not dataset_id or not isinstance(columns, list):
            continue

        grouped: Dict[str, List[str]] = defaultdict(list)
        for col in columns:
            col_name = str(col)
            md = meta_map.get(col_name, {}) if isinstance(meta_map.get(col_name), dict) else {}
            semantic_type = str(md.get("type", "unknown"))
            unit = str(md.get("unit", ""))
            group_name = f"{semantic_type}_related"
            grouped[group_name].append(col_name)

            doc_id = f"{dataset_id}.column.{col_name}"
            ids.append(doc_id)
            docs.append(build_column_text(dataset_id, col_name, md))
            metadatas.append({
                "source_type": "column",
                "dataset_id": dataset_id,
                "column_name": col_name,
                "semantic_type": semantic_type,
                "unit": unit,
                "group": group_name,
            })

        for group_name, group_cols in grouped.items():
            doc_id = f"{dataset_id}.group.{group_name}"
            ids.append(doc_id)
            docs.append(build_group_text(dataset_id, group_name, group_cols))
            metadatas.append({
                "source_type": "group",
                "dataset_id": dataset_id,
                "group": group_name,
                "column_count": len(group_cols),
            })

    return ids, docs, metadatas


def rebuild_index():
    ids, docs, metadatas = build_documents()
    print(f"문서 생성 완료: {len(ids)}개")

    if CHROMA_DIR.exists():
        print(f"기존 인덱스 삭제: {CHROMA_DIR}")
        shutil.rmtree(CHROMA_DIR)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_or_create_collection(name=COLLECTION_NAME)

    embeddings = []
    for i, text in enumerate(docs, start=1):
        embeddings.append(embed(text))
        if i % 50 == 0:
            print(f"임베딩 진행: {i}/{len(docs)}")

    collection.add(
        ids=ids,
        documents=docs,
        metadatas=metadatas,
        embeddings=embeddings,
    )
    print(f"✅ Chroma 인덱스 재빌드 완료: {COLLECTION_NAME} @ {CHROMA_DIR}")


if __name__ == "__main__":
    rebuild_index()
