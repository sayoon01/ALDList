#!/usr/bin/env python3
"""
자동 seed 생성 파이프라인

- unknown/auto_generated 컬럼 중에서
- 빈도 높고 공통으로 등장하는 컬럼들을 뽑아서
- global_columns.generated.yaml에 "초안"을 자동으로 생성

→ 사람이 나중에 고급 설명만 손봐서 global로 승격
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
META = PROJECT_ROOT / "metadata"
COLUMN_META_DIR = PROJECT_ROOT / "column_meta"
OUT = COLUMN_META_DIR / "global_columns.generated.yaml"


def main():
    union_path = META / "columns_union.json"
    by_file_path = META / "columns_by_file.json"

    if not union_path.exists() or not by_file_path.exists():
        raise SystemExit(
            "Run tools/scan_and_export.py first (need columns_union.json, columns_by_file.json)"
        )

    union = json.loads(union_path.read_text(encoding="utf-8"))
    by_file = json.loads(by_file_path.read_text(encoding="utf-8"))

    print(f"📊 columns_union.json: {len(union)} 컬럼")
    print(f"📊 columns_by_file.json: {len(by_file)} 파일")

    # 컬럼 출현 빈도(몇 개 파일에 등장하나)
    cnt = Counter()
    for _path, cols in by_file.items():
        if isinstance(cols, list):
            for c in cols:
                cnt[c] += 1

    # 상위 빈도 컬럼부터 seed 생성
    items = []
    for col in union:
        freq = cnt.get(col, 0)
        items.append((freq, col))
    items.sort(reverse=True)

    # 기존 global_columns.yaml이 있으면 제외
    existing_global_path = COLUMN_META_DIR / "global_columns.yaml"
    existing_cols = set()
    if existing_global_path.exists():
        try:
            existing_data = yaml.safe_load(existing_global_path.read_text(encoding="utf-8"))
            if isinstance(existing_data, dict):
                existing_cols = set(existing_data.keys())
                print(f"📋 global_columns.yaml: {len(existing_cols)} 컬럼 이미 존재")
        except Exception as e:
            print(f"⚠️ global_columns.yaml 로드 실패: {e}")

    out = {}
    skipped = 0
    for freq, col in items:
        # 이미 존재하는 건 생성하지 않도록
        if col in existing_cols:
            skipped += 1
            continue

        out[col] = {
            "title": col,
            "type": "unknown",
            "category": "auto",
            "unit": "",
            "equipment_field": col,
            "desc": f"[AUTO-SEED] 파일 {freq}개에서 발견됨. 설명을 구체화하세요.",
        }

    print(f"⏭️  기존 컬럼 제외: {skipped}개")
    print(f"✨ 새로 생성: {len(out)}개")

    OUT.write_text(
        yaml.safe_dump(out, allow_unicode=True, sort_keys=False, default_flow_style=False),
        encoding="utf-8",
    )
    print(f"✅ OK -> wrote {OUT} ({len(out)} cols)")


if __name__ == "__main__":
    main()
