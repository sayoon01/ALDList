#!/usr/bin/env python3
"""
union columns에서 패턴 후보를 자동 추천하는 리포트 생성기

목표:
- 하드코딩 없이 "새 컬럼명 체계"가 들어왔을 때도,
  사람이 patterns.yaml을 빨리 확장할 수 있도록 후보를 뽑아준다.

출력:
- metadata/reports/pattern_suggestions.md  (사람이 보기 좋게)
- metadata/reports/pattern_suggestions.yaml (머신 리더블)

규칙(보수적으로):
- 접두어 기반(예: AAA_BBB_CCC)으로 그룹핑
- 숫자 토큰은 (\\d+)로 일반화
- zone/part 같은 토큰 후보는 빈도 기반으로 제안
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple, Any

try:
    from utils import (
        METADATA_DIR,
        REPORTS_DIR,
        safe_load_json,
        load_columns_union,
        tokenize_column,
    )
except ImportError:
    # tools 디렉토리에서 직접 실행할 때
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        METADATA_DIR,
        REPORTS_DIR,
        safe_load_json,
        load_columns_union,
        tokenize_column,
    )

try:
    import yaml
except ImportError:
    print("❌ PyYAML이 설치되지 않았습니다. 설치해주세요: pip install pyyaml")
    sys.exit(1)

OUT_MD = REPORTS_DIR / "pattern_suggestions.md"
OUT_YAML = REPORTS_DIR / "pattern_suggestions.yaml"

TOKEN_SPLIT = re.compile(r"[._\-/\s]+")


def dump_yaml(p: Path, data: Any) -> None:
    """YAML 파일로 저장"""
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)


def generalize_tokens(tokens: List[str]) -> Tuple[str, List[str]]:
    """
    tokens를 regex로 일반화:
    - 숫자 토큰 -> (\\d+)
    - 대문자+숫자 혼합은 보수적으로 그대로 둠(나중에 확장)
    """
    rx_parts: List[str] = []
    slots: List[str] = []
    for t in tokens:
        if t.isdigit():
            rx_parts.append(r"(\d+)")
            slots.append("idx")
        else:
            # 너무 공격적으로 일반화하면 오탐이 많아짐 -> 그대로
            rx_parts.append(re.escape(t))
            slots.append("lit")
    # 원래 구분자 정보를 잃었으니 '_' 기준으로 재구성 제안
    return "^" + "_".join(rx_parts) + "$", slots


@dataclass
class Group:
    key: str  # prefix key
    cols: List[str]


def group_by_prefix(cols: List[str], prefix_len: int = 1) -> List[Group]:
    """
    prefix_len: 토큰 몇 개를 prefix로 볼지 (기본 1)
    """
    buckets: Dict[str, List[str]] = {}
    for c in cols:
        toks = tokenize_column(c)
        if not toks:
            continue
        key = "_".join(toks[:prefix_len])
        buckets.setdefault(key, []).append(c)
    groups = [Group(k, v) for k, v in buckets.items()]
    groups.sort(key=lambda g: len(g.cols), reverse=True)
    return groups


def md_escape(s: str) -> str:
    """마크다운 특수문자 이스케이프"""
    return s.replace("|", "\\|")


def main() -> None:
    union = load_columns_union()
    cols = [c for c in union if isinstance(c, str) and c]

    # 1) prefix 그룹
    groups = group_by_prefix(cols, prefix_len=1)

    suggestions: List[Dict[str, Any]] = []
    lines: List[str] = []
    lines.append("# Pattern Suggestions")
    lines.append("")
    lines.append(f"- total columns_union: **{len(cols)}**")
    lines.append("")
    lines.append("## Top Prefix Groups")
    lines.append("")

    for g in groups[:40]:
        if len(g.cols) < 5:
            break
        # 대표 컬럼 5개
        sample = g.cols[:5]
        # 가장 흔한 토큰 길이 추정
        tokenized = [tokenize_column(c) for c in g.cols]
        common_len = max(set(len(t) for t in tokenized), key=lambda x: sum(1 for tt in tokenized if len(tt) == x))

        # common_len 기반으로 regex 제안
        # 가장 대표 샘플의 tokens로 일반화
        toks0 = tokenize_column(sample[0])[:common_len]
        rx, slots = generalize_tokens(toks0)

        suggestions.append({
            "prefix": g.key,
            "count": len(g.cols),
            "suggested_match": rx,
            "slot_style": slots,
            "examples": sample,
        })

        lines.append(f"### `{g.key}` ({len(g.cols)} cols)")
        lines.append(f"- suggested `match`: `{md_escape(rx)}`")
        lines.append(f"- examples:")
        for s in sample:
            lines.append(f"  - `{md_escape(s)}`")
        lines.append("")

    dump_yaml(OUT_YAML, {"suggestions": suggestions})

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")

    print("=" * 60)
    print("pattern suggestion report generated")
    print(f"- md:   {OUT_MD}")
    print(f"- yaml: {OUT_YAML}")
    if suggestions:
        print(f"- top prefix: {suggestions[0]['prefix']} ({suggestions[0]['count']} cols)")
    print("=" * 60)


if __name__ == "__main__":
    main()
