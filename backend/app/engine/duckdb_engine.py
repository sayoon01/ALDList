"""DuckDB를 사용한 CSV 쿼리 엔진 (정리된 최종본)"""

from __future__ import annotations

import duckdb
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .duckdb_cache import get_cache


def quote_ident(name: str) -> str:
    """식별자 따옴표 처리"""
    return f'"{name.replace(chr(34), chr(34) + chr(34))}"'


def _get_conn_and_relation(
    csv_path: str, dataset_id: Optional[str]
) -> Tuple[duckdb.DuckDBPyConnection, str, bool]:
    """
    Returns: (conn, relation_sql_or_view, use_cache)
    """
    if dataset_id:
        cache = get_cache()
        conn = cache.connection()
        relation = cache.get_relation(dataset_id, csv_path)
        return conn, relation, True

    conn = duckdb.connect()
    p = Path(csv_path).resolve()
    relation = f"read_csv('{p.as_posix()}', all_varchar=true, header=true)"
    return conn, relation, False


def preview_rows(
    csv_path: str,
    offset: int = 0,
    limit: int = 2000,
    columns: Optional[List[str]] = None,
    dataset_id: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], List[str]]:
    """
    CSV 미리보기
    - dataset_id 제공 시: 캐시 view 사용 (단일 connection)
    - 미제공 시: 임시 connection으로 fallback
    """
    conn, relation, cached = _get_conn_and_relation(csv_path, dataset_id)
    try:
        if columns is None:
            r = conn.execute(f"SELECT * FROM {relation} LIMIT 1")
            columns = [d[0] for d in r.description]

        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            q = f"SELECT {col_list} FROM {relation} LIMIT {limit} OFFSET {offset}"
        else:
            q = f"SELECT * FROM {relation} LIMIT {limit} OFFSET {offset}"

        rows_raw = conn.execute(q).fetchall()
        rows = [
            {col: (row[i] if i < len(row) else None) for i, col in enumerate(columns)}
            for row in rows_raw
        ]
        return rows, columns
    finally:
        if not cached:
            conn.close()


METRICS: Dict[str, Callable[[str], str]] = {
    "count": lambda expr: "COUNT(*)",
    "non_null_count": lambda expr: f"COUNT({expr})",
    "min": lambda expr: f"MIN({expr})",
    "max": lambda expr: f"MAX({expr})",
    "avg": lambda expr: f"AVG(TRY_CAST({expr} AS DOUBLE))",
    "stddev": lambda expr: f"STDDEV(TRY_CAST({expr} AS DOUBLE))",
}


def compute_metrics(
    csv_path: str,
    columns: List[str],
    row_start: int = 0,
    row_end: Optional[int] = None,
    dataset_id: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    통계 계산 (단일 쿼리, 캐시 view 지원)
    """
    conn, relation, cached = _get_conn_and_relation(csv_path, dataset_id)
    try:
        if row_end is not None:
            limit_count = max(0, row_end - row_start)
            base_query = f"SELECT * FROM {relation} LIMIT {limit_count} OFFSET {row_start}"
        else:
            base_query = f"SELECT * FROM {relation} OFFSET {row_start}"

        base_metrics = ["count", "non_null_count", "min", "max"]
        numeric_metrics = ["avg", "stddev"]

        select_parts: List[str] = []
        metric_keys: List[tuple[str, str]] = []

        for col in columns:
            col_q = quote_ident(col)
            for metric_name in base_metrics + numeric_metrics:
                alias = f"{col}__{metric_name}"
                select_parts.append(f"{METRICS[metric_name](col_q)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))

        if not select_parts:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        query = f"SELECT {', '.join(select_parts)} FROM ({base_query})"
        result_row = conn.execute(query).fetchone()
        if result_row is None:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        out: Dict[str, Dict[str, Any]] = {col: {} for col in columns}

        for (col, metric_name), value in zip(metric_keys, result_row):
            if value is None:
                out[col][metric_name] = None
                continue

            if metric_name in ("count", "non_null_count"):
                out[col][metric_name] = int(value)
            elif metric_name in ("avg", "stddev"):
                try:
                    out[col][metric_name] = float(value)
                except Exception:
                    out[col][metric_name] = None
            else:  # min/max
                try:
                    f = float(value)
                    out[col][metric_name] = int(f) if f.is_integer() else f
                except Exception:
                    out[col][metric_name] = str(value)

        return out
    except Exception as e:
        return {col: {"count": 0, "non_null_count": 0, "error": str(e)} for col in columns}
    finally:
        if not cached:
            conn.close()


def compute_histogram(
    csv_path: str,
    column: str,
    row_start: int = 0,
    row_end: Optional[int] = None,
    bins: int = 12,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    숫자형 컬럼 분포(히스토그램) 계산.
    """
    conn, relation, cached = _get_conn_and_relation(csv_path, dataset_id)
    try:
        if row_end is not None:
            limit_count = max(0, row_end - row_start)
            base_query = f"SELECT * FROM {relation} LIMIT {limit_count} OFFSET {row_start}"
        else:
            base_query = f"SELECT * FROM {relation} OFFSET {row_start}"

        col_q = quote_ident(column)
        numeric_expr = f"TRY_CAST({col_q} AS DOUBLE)"
        value_query = f"""
        SELECT {numeric_expr} AS v
        FROM ({base_query})
        WHERE {numeric_expr} IS NOT NULL
        """

        summary_row = conn.execute(
            f"SELECT COUNT(*), MIN(v), MAX(v), AVG(v), STDDEV(v) FROM ({value_query})"
        ).fetchone()
        if not summary_row:
            return {"count": 0, "bins": [], "note": "no_data"}

        count, v_min, v_max, v_mean, v_stddev = summary_row
        if not count:
            return {"count": 0, "bins": [], "note": "no_numeric_values"}

        if v_min == v_max:
            return {
                "count": int(count),
                "min": float(v_min),
                "max": float(v_max),
                "mean": float(v_mean) if v_mean is not None else None,
                "stddev": float(v_stddev) if v_stddev is not None else None,
                "bins": [{"start": float(v_min), "end": float(v_max), "count": int(count)}],
                "note": "constant_value",
            }

        bin_count = max(5, min(int(bins), 60))
        width = (v_max - v_min) / bin_count
        hist_query = f"""
        WITH values AS (
          {value_query}
        ),
        bucketed AS (
          SELECT
            LEAST(FLOOR((v - {v_min}) / {width}), {bin_count - 1})::INTEGER AS bucket,
            COUNT(*) AS cnt
          FROM values
          GROUP BY 1
        )
        SELECT gs.i AS bucket, COALESCE(b.cnt, 0) AS cnt
        FROM generate_series(0, {bin_count - 1}) AS gs(i)
        LEFT JOIN bucketed b ON gs.i = b.bucket
        ORDER BY gs.i
        """

        rows = conn.execute(hist_query).fetchall()
        histogram_bins: List[Dict[str, Any]] = []
        for bucket_idx, bucket_count in rows:
            start = v_min + width * bucket_idx
            end = v_max if bucket_idx == bin_count - 1 else (start + width)
            histogram_bins.append({
                "start": float(start),
                "end": float(end),
                "count": int(bucket_count),
            })

        return {
            "count": int(count),
            "min": float(v_min),
            "max": float(v_max),
            "mean": float(v_mean) if v_mean is not None else None,
            "stddev": float(v_stddev) if v_stddev is not None else None,
            "bins": histogram_bins,
        }
    finally:
        if not cached:
            conn.close()
