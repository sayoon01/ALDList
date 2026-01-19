# backend/app/core/column_meta.py
"""
컬럼 메타데이터 로더 (Global + Patterns + Dataset Override)
- YAML 로딩/정규식 컴파일 비용을 요청마다 내지 않도록 프로세스 캐시
- 파일이 수정되면(mtime 변경) 자동으로 reload (hot reload)
- allowed types도 YAML에서 자동 추출해서 API 하드코딩 제거

우선순위:
1) Dataset override (dataset별 yaml)
2) Global meta (global_columns.yaml + optional generated)
3) Patterns 자동 생성 (patterns.yaml)
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple, Optional, List, Set

import yaml

ROOT = Path(__file__).resolve().parents[3]  # aldList/
META_DIR = ROOT / "column_meta"

GLOBAL_META_PATH = META_DIR / "global_columns.yaml"
# 자동 생성 결과(배치툴이 만든 파일). 존재하면 global보다 "낮은 우선순위"로 merge 권장
GLOBAL_GENERATED_PATH = META_DIR / "global_columns.generated.yaml"

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
      - {idx}: 숫자 그룹
      - {name}: 텍스트 그룹
      - {zone}: zone 코드 (U, CU, C, CL, L)
      - {part}: 부품명 (HT, PR 등)
    """
    s = template.replace("{col}", col)

    if groups:
        if groups[0].isdigit():
            s = s.replace("{idx}", groups[0])
        else:
            s = s.replace("{name}", groups[0])
            s = s.replace("{part}", groups[0])

    for g in groups:
        if g in zones:
            s = s.replace("{zone}", zones[g])

    return s


class ColumnMetaStore:
    """
    - patterns.yaml / global_columns.yaml / generated.yaml을 캐시
    - 파일 mtime 변경 시 자동 reload
    - dataset override는 파일이 dataset_id마다 다르므로, override도 캐시(선택) 가능하지만
      여기서는 '요청당 1회 로드 + mtime 캐시'로 충분히 최적화
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()

        # cached mtimes
        self._mt_global: float = -1.0
        self._mt_generated: float = -1.0
        self._mt_patterns: float = -1.0

        # cached data
        self._global_meta: Dict[str, Dict[str, Any]] = {}
        self._generated_meta: Dict[str, Dict[str, Any]] = {}
        self._zones: Dict[str, str] = {}
        self._rules: List[PatternRule] = []
        self._fallback: Dict[str, Any] = {}

        # derived
        self._allowed_types: Set[str] = set()

        # dataset override caches: dataset_id -> (mtime, data)
        self._override_cache: Dict[str, Tuple[float, Dict[str, Dict[str, Any]]]] = {}

    def _mtime(self, p: Path) -> float:
        try:
            return p.stat().st_mtime
        except FileNotFoundError:
            return -1.0

    def _load_global_meta_file(self, path: Path) -> Dict[str, Dict[str, Any]]:
        data = _safe_load_yaml(path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}
        return out

    def _load_patterns_file(self, path: Path) -> Tuple[Dict[str, str], List[PatternRule], Dict[str, Any]]:
        data = _safe_load_yaml(path)

        zones = data.get("zones") or {}
        zones = zones if isinstance(zones, dict) else {}

        patterns = data.get("patterns") or []
        fallback = data.get("fallback") or {}

        rules: List[PatternRule] = []
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

    def _rebuild_allowed_types(self) -> None:
        """
        allowed types를 YAML에서 자동 추출:
        - patterns.yaml의 각 meta.type
        - patterns.yaml의 fallback.type
        - global_columns.yaml / generated.yaml의 type
        - dataset override의 type은 런타임에서 dataset별로 달라질 수 있으므로
          "전역 allowed types"에는 포함시키지 않는 게 안정적임(원하면 확장 가능)
        """
        types: Set[str] = set()

        # from patterns
        for r in self._rules:
            t = r.meta.get("type")
            if isinstance(t, str) and t.strip():
                types.add(t.strip())
        ft = self._fallback.get("type")
        if isinstance(ft, str) and ft.strip():
            types.add(ft.strip())

        # from globals
        for m in (self._generated_meta, self._global_meta):
            for _, meta in m.items():
                t = meta.get("type")
                if isinstance(t, str) and t.strip():
                    types.add(t.strip())

        # always ensure "unknown"
        types.add("unknown")

        self._allowed_types = types

    def ensure_loaded(self) -> None:
        """
        patterns/global/generated가 바뀌었으면 자동 reload
        """
        with self._lock:
            mt_p = self._mtime(PATTERNS_PATH)
            mt_g = self._mtime(GLOBAL_META_PATH)
            mt_gg = self._mtime(GLOBAL_GENERATED_PATH)

            patterns_changed = (mt_p != self._mt_patterns)
            global_changed = (mt_g != self._mt_global)
            generated_changed = (mt_gg != self._mt_generated)

            if not (patterns_changed or global_changed or generated_changed):
                return

            if patterns_changed:
                self._zones, self._rules, self._fallback = self._load_patterns_file(PATTERNS_PATH)
                self._mt_patterns = mt_p

            if generated_changed:
                self._generated_meta = self._load_global_meta_file(GLOBAL_GENERATED_PATH)
                self._mt_generated = mt_gg

            if global_changed:
                self._global_meta = self._load_global_meta_file(GLOBAL_META_PATH)
                self._mt_global = mt_g

            self._rebuild_allowed_types()

    def get_allowed_types(self) -> List[str]:
        self.ensure_loaded()
        with self._lock:
            return sorted(self._allowed_types)

    def _load_dataset_override(self, dataset_id: str) -> Dict[str, Dict[str, Any]]:
        """
        dataset override는 dataset별 yaml을 읽는다.
        - (dataset_id.yaml이 없으면 {}) 반환
        - mtime 캐시
        """
        path = DATASET_META_DIR / f"{dataset_id}.yaml"
        mt = self._mtime(path)

        with self._lock:
            cached = self._override_cache.get(dataset_id)
            if cached and cached[0] == mt:
                return cached[1]

        data = _safe_load_yaml(path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}

        with self._lock:
            self._override_cache[dataset_id] = (mt, out)

        return out

    def generate_meta_for_column(self, col: str) -> Dict[str, Any]:
        """
        patterns 규칙으로 자동 생성
        - rules는 이미 컴파일된 정규식 사용
        """
        self.ensure_loaded()

        with self._lock:
            zones = dict(self._zones)
            rules = list(self._rules)
            fallback = dict(self._fallback)

        for rule in rules:
            m = rule.regex.match(col)
            if not m:
                continue

            groups = tuple(m.groups())
            meta = {"key": col, **rule.meta}

            if "title" in meta and isinstance(meta["title"], str):
                meta["title"] = _format_template(meta["title"], col=col, groups=groups, zones=zones)
            if "desc" in meta and isinstance(meta["desc"], str):
                meta["desc"] = _format_template(meta["desc"], col=col, groups=groups, zones=zones)

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

    def build_meta_map(self, dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        우선순위:
        1) Dataset override
        2) Global meta (global_columns.yaml) + generated.yaml(낮은 우선순위)
        3) Patterns 자동 생성
        """
        self.ensure_loaded()

        with self._lock:
            global_meta = dict(self._global_meta)
            generated_meta = dict(self._generated_meta)

        override_meta = self._load_dataset_override(dataset_id)

        result: Dict[str, Dict[str, Any]] = {}
        for c in columns:
            # 1) patterns 기본 생성
            base = self.generate_meta_for_column(c)

            # 2) generated meta merge (auto_generated False로 바꾸지 않음: "초안"이니까)
            if c in generated_meta:
                # generated는 draft 성격이므로 auto_generated는 그대로 두거나 별도 flag를 둬도 됨
                base = {**base, **generated_meta[c], "key": c}

            # 3) global meta merge (명시된 컬럼은 auto_generated False)
            if c in global_meta:
                base = {**base, **global_meta[c], "key": c, "auto_generated": False}

            # 4) dataset override merge (최우선)
            if c in override_meta:
                base = {**base, **override_meta[c], "key": c, "auto_generated": False}

            result[c] = base

        return result


# singleton
_store = ColumnMetaStore()


def get_store() -> ColumnMetaStore:
    return _store


# ---- 하위호환 함수들 (기존 import 최소 변경) ----
def build_meta_map(dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]:
    return get_store().build_meta_map(dataset_id, columns)


def generate_meta_for_column(col: str) -> Dict[str, Any]:
    return get_store().generate_meta_for_column(col)


def allowed_types() -> List[str]:
    return get_store().get_allowed_types()


# 별칭 (하위호환성)
def get_allowed_types() -> List[str]:
    """allowed_types()의 별칭"""
    return allowed_types()
