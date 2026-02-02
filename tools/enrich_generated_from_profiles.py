#!/usr/bin/env python3
"""
profiles 기반으로 global_columns.generated.yaml 자동 보강

핵심:
- LLM 없이도 profile(semantic_type/top_values/range/null_ratio 등)로 desc/title을 꽤 정확히 만들 수 있음
- 기존 패턴/글로벌 정의가 있으면 존중하고, "빈칸"을 채우는 용도로 generated를 만든다.

입력:
- metadata/datasets.json
- metadata/profiles/{ds}.json (있으면 사용)
- column_meta/patterns.yaml, column_meta/global_columns.yaml

출력:
- column_meta/global_columns.generated.yaml

정책(추천):
- 이미 global_columns.yaml에 정의된 컬럼은 generated에서 건드리지 않음
- patterns로 잡히는 type은 존중, 단 profile이 강하게 시사하면 desc/unit만 보강
- generated는 초안 레이어
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        PROFILES_DIR,
        safe_load_yaml,
        safe_load_json,
        write_yaml,
        load_columns_union,
        load_datasets,
        load_profiles,
    )
except ImportError:
    # tools 디렉토리에서 직접 실행할 때
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        PROFILES_DIR,
        safe_load_yaml,
        safe_load_json,
        write_yaml,
        load_columns_union,
        load_datasets,
        load_profiles,
    )

# backend 모듈 import 가능하게
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.column_meta import generate_meta_for_column  # noqa: E402

GLOBAL_PATH = META_DIR / "global_columns.yaml"
GENERATED_PATH = META_DIR / "global_columns.generated.yaml"
PATTERNS_PATH = META_DIR / "patterns.yaml"


def load_global() -> Dict[str, Dict[str, Any]]:
    """global_columns.yaml 로드"""
    d = safe_load_yaml(GLOBAL_PATH)
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in d.items():
        if isinstance(k, str) and isinstance(v, dict):
            out[k] = {"key": k, **v}
    return out


def load_generated() -> Dict[str, Dict[str, Any]]:
    """global_columns.generated.yaml 로드"""
    d = safe_load_yaml(GENERATED_PATH)
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in d.items():
        if isinstance(k, str) and isinstance(v, dict):
            out[k] = {"key": k, **v}
    return out


def normalize_unit_hint(col: str, pmeta: Dict[str, Any]) -> Optional[str]:
    """컬럼명 기반 단위 힌트 (매우 일반적인 것만)"""
    if re.search(r"(temp|temperature)", col, re.I):
        return "℃"
    if re.search(r"(press|pressure|vg\d+)", col, re.I):
        return "Torr"
    if re.search(r"(flow|mfc)", col, re.I):
        return "SLM"
    return None


def fmt_range(min_v: Any, max_v: Any) -> Optional[str]:
    """범위 포맷팅"""
    if min_v is None and max_v is None:
        return None
    return f"{min_v} ~ {max_v}"


def semantic_type_hint(pcol: Dict[str, Any]) -> Optional[str]:
    """profile에서 semantic_type 추출"""
    st = pcol.get("semantic_type")
    if isinstance(st, dict):
        t = st.get("type")
        if isinstance(t, str) and t:
            return t
    if isinstance(st, str) and st:
        return st
    return None


def build_desc_from_profile(col: str, pcol: Dict[str, Any]) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    desc를 만들고, 추가로 메타 필드 몇 개를 같이 추천
    """
    extra: Dict[str, Any] = {}

    st = semantic_type_hint(pcol)
    if st:
        extra["semantic_hint"] = st

    # 통계/분포
    sample = pcol.get("sample", {})
    min_v = sample.get("min")
    max_v = sample.get("max")
    nunique = sample.get("approx_distinct") or sample.get("nunique")
    null_ratio = sample.get("null_ratio")

    top_values = pcol.get("top_values") or []
    # top_values 형태가 다양할 수 있어서 정리
    top_items: List[str] = []
    if isinstance(top_values, list):
        for item in top_values[:5]:
            if isinstance(item, dict):
                v = item.get("value")
                c = item.get("count")
                if v is not None and c is not None:
                    top_items.append(f"{v}({c})")
            elif v is not None:
                top_items.append(str(v))
            else:
                top_items.append(str(item))

    parts: List[str] = []

    if st == "numeric":
        r = fmt_range(min_v, max_v)
        if r:
            parts.append(f"값 범위: {r}")
        if isinstance(null_ratio, (int, float)) and 0 <= null_ratio <= 1:
            parts.append(f"결측 비율: {null_ratio:.1%}")
    elif st in ("categorical", "string"):
        if nunique is not None:
            parts.append(f"유니크 값 수: {nunique}")
        if top_items:
            parts.append("상위 값: " + ", ".join(top_items))
        if isinstance(null_ratio, (int, float)) and 0 <= null_ratio <= 1:
            parts.append(f"결측 비율: {null_ratio:.1%}")
    elif st in ("datetime", "date", "time"):
        r = fmt_range(min_v, max_v)
        if r:
            parts.append(f"시간 범위: {r}")
    else:
        # 모르면 최소한 top만
        if top_items:
            parts.append("상위 값: " + ", ".join(top_items))

    # 컬럼명 기반 아주 얕은 설명 골격
    base = None
    if re.match(r"(?i)^no\.?$", col) or col.lower() in ("no", "idx", "index"):
        base = "행 식별/인덱스 컬럼입니다."
    elif re.search(r"(?i)time|date|timestamp", col):
        base = "시간/시각 관련 컬럼입니다."
    elif re.search(r"(?i)step", col):
        base = "공정 단계(step) 관련 컬럼입니다."
    elif re.search(r"(?i)recipe", col):
        base = "레시피/설정 관련 컬럼입니다."

    # desc 최종
    if base and parts:
        return base + " " + " / ".join(parts), extra
    if base:
        return base, extra
    if parts:
        return " / ".join(parts), extra
    return None, extra


def main() -> None:
    global_meta = load_global()
    generated = load_generated()
    
    # datasets 목록
    ds_list = load_datasets()
    
    # profiles 읽기(있는 것만)
    profiles = load_profiles()
    
    if not profiles:
        print("⚠️  프로필 파일이 없습니다. 프로필을 먼저 생성하세요:")
        print("   curl -X POST 'http://localhost:8000/api/admin/profile/{dataset_id}/build'")
        print("   또는 scan_metadata.sh를 실행하세요.")
        return

    # union columns 기준으로 전체 컬럼을 한 번 훑어서 generated를 채운다.
    union = load_columns_union()

    changed = 0
    created = 0

    for col in union:
        if not isinstance(col, str) or not col:
            continue

        # global에 이미 있으면 generated로 안 건드림(확정 레이어 우선)
        if col in global_meta:
            continue

        # patterns로 기본 생성
        base = generate_meta_for_column(col)
        # key, auto_generated 제거 (generated.yaml에는 필요 없음)
        base.pop("key", None)
        base.pop("auto_generated", None)

        # profile 기반 힌트(모든 ds 프로필에서 col이 발견될 수 있으니 first hit 사용)
        pcol = None
        for _, prof in profiles.items():
            cols = prof.get("columns")
            if isinstance(cols, dict) and col in cols and isinstance(cols[col], dict):
                pcol = cols[col]
                break

        if pcol:
            desc, extra = build_desc_from_profile(col, pcol)
            # title은 없으면 col 그대로
            if not isinstance(base.get("title"), str) or not base.get("title"):
                base["title"] = col

            # desc 보강: patterns desc가 "설명 없음"류면 교체, 아니면 뒤에 붙임
            if desc:
                old_desc = base.get("desc")
                if not isinstance(old_desc, str) or "설명 없음" in old_desc or not old_desc.strip():
                    base["desc"] = desc
                else:
                    # 기존 desc를 살리고 보강만 추가
                    base["desc"] = f"{old_desc} / {desc}"

            # unit 힌트
            if not base.get("unit"):
                u = normalize_unit_hint(col, pcol)
                if u:
                    base["unit"] = u

            # semantic hint 저장(서버/UI에서 필요하면 노출 가능)
            for k, v in extra.items():
                if k not in base:
                    base[k] = v

        # 기존 generated가 있으면 merge(수정 최소)
        old = generated.get(col)
        if old:
            # 기존 generated 우선 유지 + 새로 생성한 base에서 비어있는 것만 채우기
            merged = dict(old)
            for k, v in base.items():
                if k not in merged or merged.get(k) in ("", None):
                    merged[k] = v
            if merged != old:
                generated[col] = merged
                changed += 1
        else:
            generated[col] = base
            created += 1

    write_yaml(GENERATED_PATH, generated, sort_keys=False)

    print("=" * 60)
    print("generated.yaml updated")
    print(f"- path: {GENERATED_PATH}")
    print(f"- created: {created}")
    print(f"- changed: {changed}")
    print(f"- total keys: {len(generated)}")
    print(f"- profiles used: {len(profiles)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
