"""
컬럼 메타데이터 스토어 (캐시 + 자동 reload)
- global/patterns/override를 한 번만 로드
- 파일이 바뀌면 자동으로 reload
- 패턴 컴파일 결과를 캐시
- type 목록(allowed types)도 여기서 제공
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


@dataclass(frozen=True)
class PatternRule:
    regex: re.Pattern
    meta: Dict[str, Any]
    source: str  # 디버깅용 (rule name or index)


def _safe_load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"⚠️ YAML 로드 실패 ({path}): {e}")
        return {}


def _file_fp(p: Path) -> str:
    if not p.exists():
        return f"{p.as_posix()}|missing"
    st = p.stat()
    return f"{p.as_posix()}|{st.st_size}|{int(st.st_mtime)}"


def _format_template(template: str, *, col: str, groups: Tuple[str, ...], zones: Dict[str, str]) -> str:
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
    - patterns/global/dataset override 로드/캐시/핫리로드
    - allowed types 계산
    - meta 생성
    """

    def __init__(self, *, project_root: Path):
        self._lock = threading.RLock()

        self.root = project_root
        self.meta_dir = self.root / "column_meta"
        self.global_path = self.meta_dir / "global_columns.yaml"
        self.patterns_path = self.meta_dir / "patterns.yaml"
        self.dataset_dir = self.meta_dir / "datasets"

        self._fp_global = ""
        self._fp_patterns = ""
        self._fp_overrides: Dict[str, str] = {}

        self._global_meta: Dict[str, Dict[str, Any]] = {}
        self._zones: Dict[str, str] = {}
        self._rules: List[PatternRule] = []
        self._fallback: Dict[str, Any] = {}

        self._override_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

        self._allowed_types: List[str] = []

        self._reload_all_if_needed(force=True)

    def _reload_all_if_needed(self, *, force: bool = False) -> None:
        with self._lock:
            gfp = _file_fp(self.global_path)
            pfp = _file_fp(self.patterns_path)

            if force or gfp != self._fp_global:
                self._global_meta = self._load_global_meta()
                self._fp_global = gfp

            if force or pfp != self._fp_patterns:
                self._zones, self._rules, self._fallback = self._load_patterns_compiled()
                self._fp_patterns = pfp

            # allowed types 갱신
            self._allowed_types = self._compute_allowed_types()

    def _load_global_meta(self) -> Dict[str, Dict[str, Any]]:
        data = _safe_load_yaml(self.global_path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}
        return out

    def _load_patterns_compiled(self) -> Tuple[Dict[str, str], List[PatternRule], Dict[str, Any]]:
        data = _safe_load_yaml(self.patterns_path)

        zones = data.get("zones") or {}
        zones = zones if isinstance(zones, dict) else {}

        patterns = data.get("patterns") or []
        fallback = data.get("fallback") or {}
        fallback = fallback if isinstance(fallback, dict) else {}

        rules: List[PatternRule] = []
        if isinstance(patterns, list):
            for idx, p in enumerate(patterns):
                if not isinstance(p, dict):
                    continue
                match = p.get("match")
                meta = p.get("meta")
                source = p.get("name") or f"pattern[{idx}]"
                if isinstance(match, str) and isinstance(meta, dict):
                    try:
                        rules.append(PatternRule(regex=re.compile(match), meta=meta, source=str(source)))
                    except re.error as e:
                        print(f"⚠️ 정규식 컴파일 실패 ({match}): {e}")

        return zones, rules, fallback

    def _override_path(self, dataset_id: str) -> Path:
        return self.dataset_dir / f"{dataset_id}.yaml"

    def _load_override(self, dataset_id: str) -> Dict[str, Dict[str, Any]]:
        path = self._override_path(dataset_id)
        data = _safe_load_yaml(path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}
        return out

    def _reload_override_if_needed(self, dataset_id: str) -> None:
        with self._lock:
            path = self._override_path(dataset_id)
            fp = _file_fp(path)
            old = self._fp_overrides.get(dataset_id)
            if old != fp:
                self._override_cache[dataset_id] = self._load_override(dataset_id)
                self._fp_overrides[dataset_id] = fp

    def _compute_allowed_types(self) -> List[str]:
        types = set()

        # patterns meta + fallback type
        for r in self._rules:
            t = r.meta.get("type")
            if isinstance(t, str) and t:
                types.add(t)
        ft = self._fallback.get("type")
        if isinstance(ft, str) and ft:
            types.add(ft)

        # global meta type
        for v in self._global_meta.values():
            t = v.get("type")
            if isinstance(t, str) and t:
                types.add(t)

        # 항상 포함하고 싶은 타입들(정의상 존재)
        types.update({"unknown"})

        return sorted(types)

    def allowed_types(self) -> List[str]:
        self._reload_all_if_needed()
        return list(self._allowed_types)

    def generate_meta_for_column(self, col: str) -> Dict[str, Any]:
        self._reload_all_if_needed()

        for rule in self._rules:
            m = rule.regex.match(col)
            if not m:
                continue
            groups = tuple(m.groups())
            meta = {"key": col, **rule.meta}

            if "title" in meta and isinstance(meta["title"], str):
                meta["title"] = _format_template(meta["title"], col=col, groups=groups, zones=self._zones)
            if "desc" in meta and isinstance(meta["desc"], str):
                meta["desc"] = _format_template(meta["desc"], col=col, groups=groups, zones=self._zones)

            meta["auto_generated"] = True
            meta["_rule"] = rule.source
            return meta

        # fallback
        meta = {"key": col, **self._fallback}
        if "title" in meta and isinstance(meta["title"], str):
            meta["title"] = _format_template(meta["title"], col=col, groups=(), zones=self._zones)
        if "desc" in meta and isinstance(meta["desc"], str):
            meta["desc"] = _format_template(meta["desc"], col=col, groups=(), zones=self._zones)

        meta["auto_generated"] = True
        meta["_rule"] = "fallback"
        return meta

    def build_meta_map(self, dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]:
        self._reload_all_if_needed()
        self._reload_override_if_needed(dataset_id)

        override = self._override_cache.get(dataset_id, {})
        result: Dict[str, Dict[str, Any]] = {}

        for c in columns:
            base = self.generate_meta_for_column(c)

            if c in self._global_meta:
                base = {**base, **self._global_meta[c], "key": c, "auto_generated": False}

            if c in override:
                base = {**base, **override[c], "key": c, "auto_generated": False}

            result[c] = base

        return result


# 싱글톤
_STORE: Optional[ColumnMetaStore] = None
_LOCK = threading.Lock()


def get_column_meta_store(project_root: Path) -> ColumnMetaStore:
    global _STORE
    with _LOCK:
        if _STORE is None:
            _STORE = ColumnMetaStore(project_root=project_root)
        return _STORE
