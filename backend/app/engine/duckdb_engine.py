"""DuckDB를 사용한 CSV 쿼리 엔진 (캐시/connection 단일화 적용)"""

from __future__ import annotations

import duckdb
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .duckdb_cache import get_cache


def quote_ident(name: str) -> str:
    """식별자 따옴표 처리"""
    return f'"{name.replace(chr(34), chr(34) + chr(34))}"'


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
    if dataset_id:
        cache = get_cache()
        conn = cache.connection()
        relation = cache.get_relation(dataset_id, csv_path)

        # columns가 넘어오면 DESCRIBE 불필요
        if columns is None:
            # fallback로 1행 읽어서 description에서 추출
            result = conn.execute(f"SELECT * FROM {relation} LIMIT 1")
            columns = [d[0] for d in result.description]

        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            query = f"SELECT {col_list} FROM {relation} LIMIT {limit} OFFSET {offset}"
        else:
            query = f"SELECT * FROM {relation} LIMIT {limit} OFFSET {offset}"

        result_rows = conn.execute(query).fetchall()
        rows: List[Dict[str, Any]] = []
        for row in result_rows:
            rows.append({col: (row[i] if i < len(row) else None) for i, col in enumerate(columns)})
        return rows, columns

    # fallback: 캐시 없이 임시 connection
    conn = duckdb.connect()
    try:
        p = Path(csv_path).resolve()
        relation = f"read_csv('{p.as_posix()}', all_varchar=true, header=true)"
        if columns is None:
            result = conn.execute(f"SELECT * FROM {relation} LIMIT 1")
            columns = [d[0] for d in result.description]

        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            query = f"SELECT {col_list} FROM {relation} LIMIT {limit} OFFSET {offset}"
        else:
            query = f"SELECT * FROM {relation} LIMIT {limit} OFFSET {offset}"

        result_rows = conn.execute(query).fetchall()
        rows: List[Dict[str, Any]] = []
        for row in result_rows:
            rows.append({col: (row[i] if i < len(row) else None) for i, col in enumerate(columns)})
        return rows, columns
    finally:
        conn.close()


# 확장 가능한 메트릭 레지스트리
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
    use_cache = dataset_id is not None
    if use_cache:
        cache = get_cache()
        conn = cache.connection()
        relation = cache.get_relation(dataset_id, csv_path)
    else:
        conn = duckdb.connect()
        p = Path(csv_path).resolve()
        relation = f"read_csv_auto('{p.as_posix()}')"

    try:
        # 범위 지정
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

            for metric_name in base_metrics:
                alias = f"{col}__{metric_name}"
                select_parts.append(f"{METRICS[metric_name](col_q)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))

            for metric_name in numeric_metrics:
                alias = f"{col}__{metric_name}"
                select_parts.append(f"{METRICS[metric_name](col_q)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))

        if not select_parts:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        query = f"SELECT {', '.join(select_parts)} FROM ({base_query})"
        result_row = conn.execute(query).fetchone()
        if result_row is None:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        metrics: Dict[str, Dict[str, Any]] = {col: {} for col in columns}
        for (col, metric_name), value in zip(metric_keys, result_row):
            if value is None:
                metrics[col][metric_name] = None
                continue

            if metric_name in ("count", "non_null_count"):
                metrics[col][metric_name] = int(value)
            elif metric_name in ("avg", "stddev"):
                try:
                    metrics[col][metric_name] = float(value)
                except Exception:
                    metrics[col][metric_name] = None
            elif metric_name in ("min", "max"):
                # 가능한 경우 숫자로 변환, 아니면 문자열
                try:
                    f = float(value)
                    metrics[col][metric_name] = int(f) if f.is_integer() else f
                except Exception:
                    metrics[col][metric_name] = str(value)
            else:
                metrics[col][metric_name] = value

        return metrics

    except Exception as e:
        return {col: {"count": 0, "non_null_count": 0, "error": str(e)} for col in columns}

    finally:
        if not use_cache:
            conn.close()

