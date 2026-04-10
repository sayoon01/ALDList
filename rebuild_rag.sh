#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[rebuild_rag] 1) metadata 갱신"
./scan_metadata.sh

echo "[rebuild_rag] 2) RAG 문서/JSONL 생성"
python3 tools/export_rag.py --format all

echo "[rebuild_rag] 3) Chroma 벡터 인덱스 재빌드"
python3 tools/build_vector_index.py

echo "[rebuild_rag] done"
