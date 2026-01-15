# backend/app/core/profile_v1.py
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .registry import get_dataset, DatasetMeta
from .settings import (
    PROFILES_DIR,
    PROFILE_SAMPLE_ROWS_DEFAULT,
    PROFILE_SAMPLE_ROWS_MAX,
    PROFILE_TOPK_DEFAULT,
    PROFILE_TOPK_MAX,
)
from ..engine.duckdb_cache import get_cache


def _now_iso() -> str:
    # YYYY-MM-DDTHH:MM:SSZ 비슷하게(UTC)
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _file_row_count_estimate(csv_path: str, sample_bytes: int = 4 * 1024 * 1024) -> int:
    """
    row_count '추정' (빠르게):
    - 파일 앞부분 sample_bytes를 읽어서 평균 라인 길이 추정
    - 파일 크기 / 평균 라인 길이로 라인 수 추정
    - 헤더 1줄 제외

    장점: O(sample_bytes)로 끝. 대용량도 빠름.
    단점: 줄 길이 분포가 심하면 오차 있음(그래도 '규모' 파악용으론 충분).
    """
    p = Path(csv_path)
    size = p.stat().st_size if p.exists() else 0
    if size <= 0:
        return 0

    with p.open("rb") as f:
        chunk = f.read(min(sample_bytes, size))

    # newline 수가 너무 적으면 더 크게 읽어야 정확하지만, 일단 안전하게 처리
    nl = chunk.count(b"\n")
    if nl <= 10:
        # 최소한의 fallback: "대충" 0으로 두지 말고 1로라도
        return 0

    avg_line_bytes = max(1, len(chunk) // nl)
    est_lines = size // avg_line_bytes
    est_rows = max(0, int(est_lines) - 1)  # 헤더 제외
    return est_rows


def _build_sample_from_view(view_query: str, sample_rows: int) -> Tuple[str, bool]:
    """
    DuckDB에서 샘플링 서브쿼리 문자열을 만든다.
    - 우선: USING SAMPLE n ROWS (DuckDB 지원)
    - 실패 가능성 대비: caller에서 에러 나면 LIMIT로 fallback하도록 설계
    """
    # DuckDB 문법: FROM tbl USING SAMPLE 1000 ROWS
    sample_sql = f"(SELECT * FROM {view_query} USING SAMPLE {sample_rows} ROWS)"
    return sample_sql, True


def _quote_ident(name: str) -> str:
    return f'"{name.replace(chr(34), chr(34) * 2)}"'


def _null_expr(col_ident: str) -> str:
    """
    all_varchar=true일 때, 빈 문자열/공백/"nan"/"null" 같은 것도 null 취급
    """
    return (
        f"( {col_ident} IS NULL OR "
        f"TRIM({col_ident}) = '' OR "
        f"LOWER(TRIM({col_ident})) IN ('nan','null','none') )"
    )


def _bool_like_expr(col_ident: str) -> str:
    return (
        f"(LOWER(TRIM({col_ident})) IN "
        f"('true','false','t','f','yes','no','y','n','0','1'))"
    )


def _numeric_like_expr(col_ident: str) -> str:
    # TRY_CAST 실패 시 NULL → numeric_like count에 안 잡힘
    return f"(TRY_CAST(TRIM({col_ident}) AS DOUBLE) IS NOT NULL)"


def _datetime_like_expr(col_ident: str) -> str:
    # DuckDB TRY_CAST timestamp: 꽤 많은 포맷을 받아줌
    # 필요하면 나중에 TRY_STRPTIME 포맷 후보를 추가하면 됨
    return f"(TRY_CAST(TRIM({col_ident}) AS TIMESTAMP) IS NOT NULL)"


def _semantic_type_from_ratios(
    *,
    non_null: int,
    numeric_like: int,
    datetime_like: int,
    bool_like: int,
) -> Tuple[str, float]:
    """
    관찰 기반 semantic_type 판단.
    기준은 'non_null 중 어떤 형태가 지배적인가'
    """
    if non_null <= 0:
        return "unknown", 0.0

    r_num = numeric_like / non_null
    r_dt = datetime_like / non_null
    r_bool = bool_like / non_null

    # 우선순위: datetime > boolean > numeric > text
    if r_dt >= 0.90:
        return "datetime", float(r_dt)
    if r_bool >= 0.95:
        return "boolean", float(r_bool)
    if r_num >= 0.95:
        return "numeric", float(r_num)

    # "범주(categorical)" 판단은 distinct 추정과 같이 보는 게 보통 맞음
    # v1에서는 semantic_type은 text로 두고, doc에서 별도로 범주 여부를 표시하는 방향이 안전
    return "text", float(max(r_num, r_dt, r_bool))


@dataclass
class ProfileBuildResult:
    dataset_id: str
    path: str
    built_at: str
    sample_rows: int
    row_count_estimate: int
    columns_profiled: int


def build_profile_v1(
    dataset_id: str,
    *,
    sample_rows: int = PROFILE_SAMPLE_ROWS_DEFAULT,
    top_k: int = PROFILE_TOPK_DEFAULT,
    force: bool = False,
) -> ProfileBuildResult:
    """
    Profile v1 생성:
    - row_count 추정 (파일 기반)
    - column별 null ratio (샘플 기반)
    - semantic_type(관찰 기반) (샘플 기반)
    - distinct count (샘플 기반, 근사)
    - top-k values (샘플 기반)
    """
    ds: Optional[DatasetMeta] = get_dataset(dataset_id)
    if ds is None:
        raise ValueError(f"Dataset not found: {dataset_id}")

    sample_rows = max(100, min(int(sample_rows), PROFILE_SAMPLE_ROWS_MAX))
    top_k = max(1, min(int(top_k), PROFILE_TOPK_MAX))

    profile_path = PROFILES_DIR / f"{dataset_id}.json"

    # 캐시가 있고 force가 아니면 mtime 비교로 스킵 가능
    if profile_path.exists() and not force:
        try:
            existing = json.loads(profile_path.read_text(encoding="utf-8"))
            if existing.get("source", {}).get("mtime") == ds.mtime:
                return ProfileBuildResult(
                    dataset_id=dataset_id,
                    path=str(profile_path),
                    built_at=existing.get("built_at", _now_iso()),
                    sample_rows=int(existing.get("sample", {}).get("rows", sample_rows)),
                    row_count_estimate=int(existing.get("row_count_estimate", 0)),
                    columns_profiled=len(existing.get("columns", {}) or {}),
                )
        except Exception:
            # 읽기 실패면 그냥 재생성
            pass

    cache = get_cache()
    view_query = cache.get_view_query(dataset_id, ds.path)
    conn = cache._get_or_create_connection(dataset_id)

    row_count_estimate = _file_row_count_estimate(ds.path)

    # ✅ 샘플링 서브쿼리 만들기
    sample_subq, _ = _build_sample_from_view(view_query, sample_rows)

    # ✅ 1쿼리로 "모든 컬럼" null_count / non_null / numeric_like / datetime_like / bool_like / approx_distinct
    # 엄청 중요한 포인트: 컬럼이 200개여도 1번만 스캔하게 만드는 게 핵심
    cols = list(ds.columns)

    select_parts: List[str] = []
    keys: List[Tuple[str, str]] = []  # (col, metric)

    for col in cols:
        c = _quote_ident(col)
        null_expr = _null_expr(c)
        bool_expr = _bool_like_expr(c)
        num_expr = _numeric_like_expr(c)
        dt_expr = _datetime_like_expr(c)

        # null_count
        select_parts.append(f"SUM(CASE WHEN {null_expr} THEN 1 ELSE 0 END) AS {_quote_ident(col + '__null')}")
        keys.append((col, "null"))

        # non_null_count
        select_parts.append(f"SUM(CASE WHEN NOT({null_expr}) THEN 1 ELSE 0 END) AS {_quote_ident(col + '__non_null')}")
        keys.append((col, "non_null"))

        # numeric_like
        select_parts.append(
            f"SUM(CASE WHEN NOT({null_expr}) AND {num_expr} THEN 1 ELSE 0 END) AS {_quote_ident(col + '__numeric_like')}"
        )
        keys.append((col, "numeric_like"))

        # datetime_like
        select_parts.append(
            f"SUM(CASE WHEN NOT({null_expr}) AND {dt_expr} THEN 1 ELSE 0 END) AS {_quote_ident(col + '__datetime_like')}"
        )
        keys.append((col, "datetime_like"))

        # bool_like
        select_parts.append(
            f"SUM(CASE WHEN NOT({null_expr}) AND {bool_expr} THEN 1 ELSE 0 END) AS {_quote_ident(col + '__bool_like')}"
        )
        keys.append((col, "bool_like"))

        # distinct count (샘플 기반 근사)
        # - null/빈값 제외하려면 FILTER를 쓰고 싶지만, DuckDB에선 보통 WHERE로 래핑이 안전
        # - 여기서는 NULL/빈값 포함 distinct를 먼저 찍고, null_ratio와 같이 해석하게 둔다
        select_parts.append(
            f"APPROX_COUNT_DISTINCT({c}) AS {_quote_ident(col + '__approx_distinct')}"
        )
        keys.append((col, "approx_distinct"))

    # sample_rows가 실제로는 더 적을 수 있음(파일이 작으면)
    # 그래서 sample_n은 별도로 뽑는다
    query = f"""
    SELECT
      COUNT(*) AS sample_n,
      {", ".join(select_parts)}
    FROM {sample_subq}
    """

    try:
        row = conn.execute(query).fetchone()
        if row is None:
            raise RuntimeError("Profile query returned no result")
    except Exception:
        # USING SAMPLE이 환경/버전에 따라 실패할 수 있으니 LIMIT fallback
        sample_subq = f"(SELECT * FROM {view_query} LIMIT {sample_rows})"
        query = f"""
        SELECT
          COUNT(*) AS sample_n,
          {", ".join(select_parts)}
        FROM {sample_subq}
        """
        row = conn.execute(query).fetchone()
        if row is None:
            raise RuntimeError("Profile query returned no result (fallback too)")

    # row[0] = sample_n
    sample_n = int(row[0] or 0)

    # reshape
    idx = 1
    temp: Dict[str, Dict[str, Any]] = {c: {} for c in cols}
    for (col, metric_name) in keys:
        val = row[idx]
        idx += 1
        if val is None:
            temp[col][metric_name] = 0
        else:
            # duckdb SUM returns int-like, approx_count_distinct returns int-like
            try:
                temp[col][metric_name] = int(val)
            except Exception:
                temp[col][metric_name] = val

    # ✅ top-k values: 이건 컬럼마다 GROUP BY가 필요해서 1쿼리로 끝내기 어렵다.
    # 대신 sample 기반이고, 전체 행 스캔이 아니라서 버틸만 함.
    columns_out: Dict[str, Any] = {}
    for col in cols:
        null_cnt = int(temp[col].get("null", 0))
        non_null = int(temp[col].get("non_null", 0))
        approx_dist = int(temp[col].get("approx_distinct", 0))
        numeric_like = int(temp[col].get("numeric_like", 0))
        datetime_like = int(temp[col].get("datetime_like", 0))
        bool_like = int(temp[col].get("bool_like", 0))

        semantic_type, confidence = _semantic_type_from_ratios(
            non_null=non_null,
            numeric_like=numeric_like,
            datetime_like=datetime_like,
            bool_like=bool_like,
        )

        null_ratio = (null_cnt / sample_n) if sample_n > 0 else 1.0

        # top-k
        c = _quote_ident(col)
        null_expr = _null_expr(c)
        top_query = f"""
        SELECT {c} AS v, COUNT(*) AS cnt
        FROM {sample_subq}
        WHERE NOT({null_expr})
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT {top_k}
        """
        try:
            tops = conn.execute(top_query).fetchall()
            top_values = [{"value": (v if v is not None else None), "count": int(cnt)} for v, cnt in tops]
        except Exception:
            top_values = []

        columns_out[col] = {
            "sample": {
                "count": sample_n,
                "null_count": null_cnt,
                "non_null_count": non_null,
                "null_ratio": float(null_ratio),
                "approx_distinct": approx_dist,
            },
            "semantic_type": {
                "type": semantic_type,
                "confidence": float(confidence),
                "evidence": {
                    "numeric_like": numeric_like,
                    "datetime_like": datetime_like,
                    "bool_like": bool_like,
                    "non_null": non_null,
                },
            },
            "top_values": top_values,
        }

    profile_obj = {
        "version": "profile_v1",
        "dataset_id": dataset_id,
        "built_at": _now_iso(),
        "source": {
            "path": ds.path,
            "filename": ds.filename,
            "size_bytes": ds.size_bytes,
            "mtime": ds.mtime,
        },
        "row_count_estimate": row_count_estimate,
        "sample": {
            "rows": sample_rows,
            "actual_rows": sample_n,
            "top_k": top_k,
            "strategy": "duckdb_sample_or_limit",
        },
        "columns": columns_out,
    }

    profile_path.write_text(json.dumps(profile_obj, ensure_ascii=False, indent=2), encoding="utf-8")

    return ProfileBuildResult(
        dataset_id=dataset_id,
        path=str(profile_path),
        built_at=profile_obj["built_at"],
        sample_rows=sample_rows,
        row_count_estimate=row_count_estimate,
        columns_profiled=len(columns_out),
    )
