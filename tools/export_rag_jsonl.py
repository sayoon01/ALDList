#!/usr/bin/env python3
"""
컬럼 메타데이터를 RAG 인덱싱용 JSONL 파일로 변환하는 스크립트

global_columns.yaml을 읽어서:
- rag_index/column_meta.jsonl 생성
- 각 줄은 JSON 객체 하나 (JSONL 형식)
- Vector DB 인덱싱에 최적화된 형태
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Any
import json

try:
    import yaml
except ImportError:
    print("❌ PyYAML이 설치되지 않았습니다. 설치해주세요: pip install pyyaml")
    exit(1)

ROOT = Path(__file__).resolve().parents[1]
META_FILE = ROOT / "column_meta" / "global_columns.yaml"
OUT_DIR = ROOT / "rag_index"
OUT_FILE = OUT_DIR / "column_meta.jsonl"

OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    """메인 실행 함수"""
    # 입력 파일 확인
    if not META_FILE.exists():
        print(f"❌ 메타데이터 파일을 찾을 수 없습니다: {META_FILE}")
        exit(1)

    # YAML 파일 로드
    print(f"📖 메타데이터 읽는 중: {META_FILE}")
    with META_FILE.open("r", encoding="utf-8") as f:
        meta = yaml.safe_load(f) or {}

    if not isinstance(meta, dict):
        print(f"❌ YAML 파일 형식이 올바르지 않습니다. 딕셔너리여야 합니다.")
        exit(1)

    # JSONL 파일 생성
    print(f"📝 JSONL 파일 생성 중: {OUT_FILE}")
    count = 0
    with OUT_FILE.open("w", encoding="utf-8") as f:
        for col, m in meta.items():
            if not isinstance(m, dict):
                continue

            # 문서 구성
            doc = {
                "id": f"column:{col}",
                "column": col,
                "type": m.get("type", "unknown"),
                "category": m.get("category", ""),
                "equipment_field": m.get("equipment_field", col),
                "text": (
                    f"이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. "
                    f"{m.get('desc', '')} "
                    f"이 필드는 {m.get('type', 'unknown')} 유형이다."
                ).strip()
            }

            # JSONL 형식으로 쓰기 (한 줄에 JSON 객체 하나)
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            count += 1

    print(f"✅ RAG JSONL 생성 완료: {OUT_FILE}")
    print(f"   - 생성된 문서 수: {count}개")


if __name__ == "__main__":
    main()

