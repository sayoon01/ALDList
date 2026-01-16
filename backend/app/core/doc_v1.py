# backend/app/core/doc_v1.py
"""
Doc V1 생성: 간결한 데이터셋 문서

원칙:
- 상단: 데이터셋 요약
- 의미 그룹별: 컬럼 개수 + 대표 컬럼 Top N만
- 관찰별: null_ratio 높은 컬럼, categorical, datetime 후보 등 핵심만
- 전체 상세는 UI에서 클릭해서 보기
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any, List, Tuple
from datetime import datetime

from .registry import get_dataset
from .column_meta import build_meta_map
from .settings import DOCS_DIR, PROFILES_DIR


def _now_iso() -> str:
    """현재 시간을 ISO 형식으로 반환"""
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _load_profile_json(dataset_id: str) -> Dict[str, Any] | None:
    """프로필 JSON 파일 로드 (없으면 None 반환)"""
    p = PROFILES_DIR / f"{dataset_id}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def _group_by_type(meta_map: Dict[str, Dict[str, Any]], columns: List[str]) -> Dict[str, List[str]]:
    """컬럼을 타입별로 그룹화"""
    out: Dict[str, List[str]] = {}
    for c in columns:
        t = (meta_map.get(c, {}) or {}).get("type") or "unknown"
        out.setdefault(t, []).append(c)
    return out


def _top_n_columns_for_group(
    meta_map: Dict[str, Dict[str, Any]], cols: List[str], n: int
) -> List[Tuple[str, str]]:
    """그룹 내 대표 컬럼 Top N 반환: (title, desc)"""
    out: List[Tuple[str, str]] = []
    for c in cols[:n]:
        m = meta_map.get(c, {}) or {}
        title = m.get("title") or c
        desc = m.get("desc") or ""
        out.append((title, desc))
    return out


def _pick_profile_highlights(profile: Dict[str, Any], top_n: int = 12) -> Dict[str, List[Dict[str, Any]]]:
    """
    프로필에서 핵심 정보만 추출:
    - null_ratio 높은 컬럼
    - categorical 후보
    - datetime 후보
    """
    columns_data = profile.get("columns", {})
    
    # columns가 딕셔너리 형태인지 확인
    if isinstance(columns_data, dict):
        cols_list = [
            {"name": col_name, **col_data}
            for col_name, col_data in columns_data.items()
        ]
    elif isinstance(columns_data, list):
        cols_list = columns_data
    else:
        cols_list = []

    # null ratio 높은 컬럼 정렬
    null_sorted = sorted(
        [c for c in cols_list if isinstance(c, dict)],
        key=lambda x: float(
            x.get("sample", {}).get("null_ratio", 0.0)
            if isinstance(x.get("sample"), dict)
            else x.get("sample_null_ratio", 0.0)
        ),
        reverse=True,
    )

    # categorical / datetime 후보 추출
    categorical = []
    datetime_cand = []
    
    for c in cols_list:
        if not isinstance(c, dict):
            continue
        
        sem_type_info = c.get("semantic_type", {})
        if isinstance(sem_type_info, dict):
            sem_type = sem_type_info.get("type", "")
        else:
            sem_type = str(sem_type_info) if sem_type_info else ""
        
        if sem_type == "categorical" or (
            sem_type == "text"
            and c.get("sample", {}).get("approx_distinct", 0) < 100
            if isinstance(c.get("sample"), dict)
            else c.get("sample_distinct", 0) < 100
        ):
            categorical.append(c)
        
        if sem_type == "datetime":
            datetime_cand.append(c)

    def slim(x: Dict[str, Any]) -> Dict[str, Any]:
        """컬럼 정보를 간결하게 정리"""
        sample_info = x.get("sample", {}) if isinstance(x.get("sample"), dict) else {}
        sem_type_info = x.get("semantic_type", {})
        
        if isinstance(sem_type_info, dict):
            sem_type = sem_type_info.get("type", "unknown")
        else:
            sem_type = str(sem_type_info) if sem_type_info else "unknown"
        
        tv = x.get("top_values", [])
        if isinstance(tv, list):
            tv = tv[:5]
        else:
            tv = []
        
        return {
            "name": x.get("name", ""),
            "semantic_type": sem_type,
            "sample_null_ratio": (
                sample_info.get("null_ratio", 0.0)
                if sample_info
                else x.get("sample_null_ratio", 0.0)
            ),
            "sample_distinct": (
                sample_info.get("approx_distinct", 0)
                if sample_info
                else x.get("sample_distinct", 0)
            ),
            "top_values": tv,
        }

    return {
        "null_ratio_top": [slim(x) for x in null_sorted[:top_n]],
        "categorical_top": [slim(x) for x in categorical[:top_n]],
        "datetime_candidates": [slim(x) for x in datetime_cand[:top_n]],
    }


def build_doc_v1(
    dataset_id: str, *, group_top_n: int = 12, highlight_top_n: int = 12
) -> str:
    """
    Doc V1 생성: 간결한 데이터셋 문서
    
    Args:
        dataset_id: 데이터셋 ID
        group_top_n: 그룹별 표시할 컬럼 개수
        highlight_top_n: 프로필 하이라이트 표시 개수
    
    Returns:
        생성된 문서 파일 경로
    """
    ds = get_dataset(dataset_id)
    if not ds:
        raise ValueError("Dataset not found")

    # column_meta
    meta_map = build_meta_map(dataset_id, list(ds.columns))
    grouped = _group_by_type(meta_map, list(ds.columns))

    # profile (optional)
    prof = _load_profile_json(dataset_id)

    lines: List[str] = []
    lines.append(f"# Dataset: {ds.filename}")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Dataset ID: `{dataset_id}`")
    lines.append(f"- File size: {ds.size_bytes:,} bytes")
    lines.append(f"- Column count: {len(ds.columns)}")
    lines.append(f"- Generated at: {_now_iso()}")
    
    if prof:
        row_count_est = prof.get("row_count_estimate")
        if row_count_est is not None:
            lines.append(f"- Row count (estimate): {row_count_est:,}")
        
        row_count_exact = prof.get("row_count_exact")
        if row_count_exact is not None:
            lines.append(f"- Row count (exact): {row_count_exact:,}")
        
        sample_info = prof.get("sample", {})
        if isinstance(sample_info, dict):
            sample_rows = sample_info.get("rows") or sample_info.get("actual_rows")
            if sample_rows:
                lines.append(f"- Profile sample rows used: {sample_rows:,}")
        else:
            sample_rows = prof.get("sample_rows_used")
            if sample_rows:
                lines.append(f"- Profile sample rows used: {sample_rows:,}")
    
    lines.append("")

    # Column groups (by meaning)
    lines.append("## Column groups (by meaning)")
    
    # 그룹 순서: 자주 쓰는 것 먼저
    preferred = [
        "timestamp",
        "recipe",
        "index",
        "temperature",
        "pressure",
        "apc",
        "gas",
        "valve",
        "aux",
        "heater",
        "unknown",
    ]
    keys = [k for k in preferred if k in grouped] + [
        k for k in grouped.keys() if k not in preferred
    ]

    for t in keys:
        cols = grouped.get(t, [])
        if not cols:
            continue
        
        lines.append(f"### {t} ({len(cols)} cols)")
        top_items = _top_n_columns_for_group(meta_map, cols, group_top_n)
        
        for title, desc in top_items:
            if desc:
                lines.append(f"- **{title}** — {desc}")
            else:
                lines.append(f"- **{title}**")
        
        if len(cols) > group_top_n:
            lines.append(f"- ... (+{len(cols) - group_top_n} more)")
        
        lines.append("")

    # Profile highlights (by observation)
    if prof:
        lines.append("## Profile highlights (by observation)")
        hl = _pick_profile_highlights(prof, top_n=highlight_top_n)

        def render_block(title: str, items: List[Dict[str, Any]]):
            lines.append(f"### {title}")
            if not items:
                lines.append("- (none)")
                lines.append("")
                return
            
            for x in items:
                name = x.get("name", "")
                sem_type = x.get("semantic_type", "unknown")
                null_ratio = x.get("sample_null_ratio", 0.0)
                distinct = x.get("sample_distinct", 0)
                
                lines.append(
                    f"- **{name}** | type=`{sem_type}` | null_ratio={null_ratio:.4f} | distinct={distinct:,}"
                )
                
                tv = x.get("top_values", [])
                if isinstance(tv, list) and tv:
                    tops = ", ".join(
                        [
                            f"{v.get('value')}({v.get('count')})"
                            for v in tv[:5]
                            if v.get("value") is not None
                        ]
                    )
                    if tops:
                        lines.append(f"  - top: {tops}")
            
            lines.append("")

        render_block("Null ratio top", hl["null_ratio_top"])
        render_block("Categorical candidates", hl["categorical_top"])
        render_block("Datetime candidates", hl["datetime_candidates"])

    lines.append("---")
    lines.append("Note: Full details are available via API/UI (do not dump every column here).")
    lines.append("")

    # 저장
    out_path = DOCS_DIR / f"{dataset_id}.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return str(out_path)
