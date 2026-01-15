# backend/app/core/doc_v1.py
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

from .registry import get_dataset
from .column_meta import build_meta_map
from .settings import DOCS_DIR, PROFILES_DIR


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _load_profile(dataset_id: str) -> Dict[str, Any]:
    p = PROFILES_DIR / f"{dataset_id}.json"
    if not p.exists():
        raise FileNotFoundError(f"profile not found: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def build_doc_v1(dataset_id: str, *, top_columns_per_group: int = 10) -> str:
    """
    Doc V1 생성:
    - profile + column_meta를 읽어서 Markdown 생성
    - metadata/docs/{dataset_id}.md 로 저장
    
    원칙:
    - Column Groups (의미 기준): column_meta 사용
    - Column Profiles (관찰 기준): profile 사용
    - 두 섹션을 명확히 분리
    """
    ds = get_dataset(dataset_id)
    if not ds:
        raise ValueError("Dataset not found")

    profile = _load_profile(dataset_id)
    meta_map = build_meta_map(dataset_id, list(ds.columns))

    # ---------- 1. Dataset Summary ----------
    lines: List[str] = []
    lines.append(f"# Dataset: {ds.filename}")
    lines.append("")
    lines.append("## 1. Dataset Summary")
    lines.append(f"- Dataset ID: `{dataset_id}`")
    lines.append(f"- File size: {ds.size_bytes:,} bytes")
    lines.append(f"- File mtime: {ds.mtime}")
    
    # 프로파일에서 컬럼 수 가져오기
    columns_data = profile.get("columns", {})
    column_count = len(columns_data) if isinstance(columns_data, dict) else profile.get("column_count", len(ds.columns))
    
    lines.append(f"- Column count: {column_count}")
    lines.append(f"- Row count (estimate): {profile.get('row_count_estimate', 'N/A')}")
    
    # exact row_count는 profile에 없을 수 있음
    row_count_exact = profile.get("row_count_exact")
    if row_count_exact is not None:
        lines.append(f"- Row count (exact): {row_count_exact:,}")
    else:
        lines.append(f"- Row count (exact): N/A")
    
    lines.append(f"- Profile generated at: {profile.get('built_at', profile.get('generated_at', 'N/A'))}")
    lines.append("")

    # ---------- 2. Column Groups (의미 기준) ----------
    lines.append("## 2. Column Groups (by meaning)")
    groups: Dict[str, List[str]] = {}

    for col, meta in meta_map.items():
        t = meta.get("type", "unknown")
        groups.setdefault(t, []).append(col)

    for t, cols in sorted(groups.items()):
        lines.append(f"### {t}")
        for c in cols[:top_columns_per_group]:
            col_meta = meta_map.get(c, {})
            title = col_meta.get("title", c)
            desc = col_meta.get("desc", "")
            lines.append(f"- **{c}**: {title}")
            if desc:
                lines.append(f"  - {desc}")
        if len(cols) > top_columns_per_group:
            lines.append(f"  - ... (+{len(cols) - top_columns_per_group} more)")
        lines.append("")

    # ---------- 3. Column Profiles (관찰 기준) ----------
    lines.append("## 3. Column Profiles (by observation)")
    lines.append("")

    # 프로파일의 columns는 딕셔너리 형태
    prof_cols = profile.get("columns", {})
    if not isinstance(prof_cols, dict):
        # 호환성을 위해 리스트 형태도 처리
        prof_cols = {c.get("name", ""): c for c in prof_cols if isinstance(c, dict)}

    # 컬럼 이름 순서대로 정렬
    for col_name in sorted(prof_cols.keys()):
        cprof = prof_cols[col_name]
        lines.append(f"### {col_name}")
        
        # semantic_type 정보
        sem_type_info = cprof.get("semantic_type", {})
        if isinstance(sem_type_info, dict):
            sem_type = sem_type_info.get("type", "unknown")
            confidence = sem_type_info.get("confidence", 0.0)
            lines.append(f"- semantic_type: `{sem_type}` (confidence: {confidence:.2f})")
        else:
            lines.append(f"- semantic_type: `{sem_type_info}`")
        
        # sample 정보
        sample_info = cprof.get("sample", {})
        if isinstance(sample_info, dict):
            null_ratio = sample_info.get("null_ratio", 0.0)
            distinct_count = sample_info.get("approx_distinct", 0)
            sample_count = sample_info.get("count", 0)
            lines.append(f"- null_ratio (sample): {null_ratio:.4f}")
            lines.append(f"- distinct_count (sample): {distinct_count:,}")
            lines.append(f"- sample_size: {sample_count:,}")
        else:
            # 호환성을 위해
            lines.append(f"- null_ratio (sample): {cprof.get('sample_null_ratio', 'N/A')}")
            lines.append(f"- distinct_count (sample): {cprof.get('sample_distinct', 'N/A')}")

        # top values
        top_vals = cprof.get("top_values", [])
        if top_vals:
            lines.append("- top values:")
            for tv in top_vals[:10]:  # 최대 10개만 표시
                value = tv.get("value")
                count = tv.get("count", 0)
                if value is not None:
                    lines.append(f"  - `{value}` ({count:,})")
                else:
                    lines.append(f"  - `null` ({count:,})")
        lines.append("")

    # ---------- save ----------
    out_path = DOCS_DIR / f"{dataset_id}.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return str(out_path)
