"""컬럼 메타데이터 로더 (Global + Patterns + Dataset Override)"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple

import yaml


ROOT = Path(__file__).resolve().parents[3]  # aldList/
META_DIR = ROOT / "column_meta"
GLOBAL_META_PATH = META_DIR / "global_columns.yaml"
PATTERNS_PATH = META_DIR / "patterns.yaml"
DATASET_META_DIR = META_DIR / "datasets"


def _safe_load_yaml(path: Path) -> Dict[str, Any]:
    """YAML 파일을 안전하게 로드"""
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"⚠️  YAML 로드 실패 ({path}): {e}")
        return {}


def load_global_meta() -> Dict[str, Dict[str, Any]]:
    """전역 컬럼 메타데이터 로드"""
    data = _safe_load_yaml(GLOBAL_META_PATH)
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in data.items():
        if isinstance(k, str) and isinstance(v, dict):
            out[k] = {"key": k, **v}
    return out


def load_dataset_override(dataset_id: str) -> Dict[str, Dict[str, Any]]:
    """데이터셋별 오버라이드 메타데이터 로드"""
    path = DATASET_META_DIR / f"{dataset_id}.yaml"
    data = _safe_load_yaml(path)
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in data.items():
        if isinstance(k, str) and isinstance(v, dict):
            out[k] = {"key": k, **v}
    return out


@dataclass(frozen=True)
class PatternRule:
    """패턴 규칙"""
    regex: re.Pattern
    meta: Dict[str, Any]


def _format_template(
    template: str,
    *,
    col: str,
    groups: Tuple[str, ...],
    zones: Dict[str, str],
) -> str:
    """
    템플릿 문자열에서 토큰 치환
    
    지원 토큰:
    - {col}: 컬럼명 전체
    - {idx}: 숫자 그룹 (밸브 번호 등)
    - {name}: 텍스트 그룹 (가스명 등)
    - {zone}: zone 코드 (U, CU, C, CL, L)
    - {part}: 부품명 (HT, PR 등)
    """
    s = template.replace("{col}", col)

    # groups 기반 치환(규칙마다 의미가 다름)
    # - 첫 그룹이 숫자면 idx
    # - 첫 그룹이 텍스트면 name/part 등으로 활용 가능
    if groups:
        if groups[0].isdigit():
            s = s.replace("{idx}", groups[0])
        else:
            s = s.replace("{name}", groups[0])
            s = s.replace("{part}", groups[0])

    # zone: 마지막 그룹이 zone code인 케이스가 많음
    for g in groups:
        if g in zones:
            s = s.replace("{zone}", zones[g])
    return s


def load_patterns() -> Tuple[Dict[str, str], list[PatternRule], Dict[str, Any]]:
    """패턴 규칙 로드"""
    data = _safe_load_yaml(PATTERNS_PATH)
    zones = data.get("zones") or {}
    zones = zones if isinstance(zones, dict) else {}
    patterns = data.get("patterns") or []
    fallback = data.get("fallback") or {}

    rules: list[PatternRule] = []
    if isinstance(patterns, list):
        for p in patterns:
            if not isinstance(p, dict):
                continue
            match = p.get("match")
            meta = p.get("meta")
            if isinstance(match, str) and isinstance(meta, dict):
                try:
                    rules.append(PatternRule(regex=re.compile(match), meta=meta))
                except re.error as e:
                    print(f"⚠️  정규식 컴파일 실패 ({match}): {e}")

    return zones, rules, fallback if isinstance(fallback, dict) else {}


def generate_meta_for_column(col: str) -> Dict[str, Any]:
    """패턴 규칙을 사용하여 컬럼 메타데이터 자동 생성"""
    zones, rules, fallback = load_patterns()

    for rule in rules:
        m = rule.regex.match(col)
        if not m:
            continue

        groups = tuple(m.groups())
        meta = {"key": col, **rule.meta}

        # template 처리: title/desc에서 토큰 치환
        if "title" in meta and isinstance(meta["title"], str):
            meta["title"] = _format_template(meta["title"], col=col, groups=groups, zones=zones)
        if "desc" in meta and isinstance(meta["desc"], str):
            meta["desc"] = _format_template(meta["desc"], col=col, groups=groups, zones=zones)

        # MFCMon_ 처럼 groups가 길게 잡히는 경우 {name}에 전체를 넣고 싶으면:
        if "{name}" in str(rule.meta.get("title", "")) or "{name}" in str(rule.meta.get("desc", "")):
            # name은 첫 그룹 전체로 처리(정규식이 (.+)라면 전체가 들어감)
            pass

        meta["auto_generated"] = True
        return meta

    # fallback
    meta = {"key": col, **fallback}
    if "title" in meta and isinstance(meta["title"], str):
        meta["title"] = _format_template(meta["title"], col=col, groups=(), zones=zones)
    if "desc" in meta and isinstance(meta["desc"], str):
        meta["desc"] = _format_template(meta["desc"], col=col, groups=(), zones=zones)
    meta["auto_generated"] = True
    return meta


def build_meta_map(dataset_id: str, columns: list[str]) -> Dict[str, Dict[str, Any]]:
    """
    컬럼 목록에 대해 메타데이터 맵 생성
    
    우선순위:
    1. Dataset override (최우선)
    2. Global meta
    3. Patterns 자동 생성 (fallback 포함)
    
    Args:
        dataset_id: 데이터셋 ID
        columns: 컬럼명 리스트
    
    Returns:
        컬럼명을 키로 하는 메타데이터 딕셔너리 (모든 컬럼에 대해 항상 존재)
    """
    global_meta = load_global_meta()
    override_meta = load_dataset_override(dataset_id)

    result: Dict[str, Dict[str, Any]] = {}
    for c in columns:
        # 1) patterns로 기본 생성
        base = generate_meta_for_column(c)

        # 2) global merge
        if c in global_meta:
            base = {**base, **global_meta[c], "key": c, "auto_generated": base.get("auto_generated", False)}

        # 3) dataset override merge (최우선)
        if c in override_meta:
            base = {**base, **override_meta[c], "key": c, "auto_generated": False}

        result[c] = base

    return result
