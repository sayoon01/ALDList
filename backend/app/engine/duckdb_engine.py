from __future__ import annotations
import duckdb
from typing import Any

def quote_ident(col: str) -> str:
    # 안전하게 컬럼명 quoting
    return '"' + col.replace('"', '""') + '"'

def preview_rows(csv_path: str, offset: int, limit: int) -> list[dict[str, Any]]:
    con = duckdb.connect(database=":memory:")
    q = f"""
      SELECT *
      FROM read_csv_auto('{csv_path}')
      LIMIT {limit} OFFSET {offset}
    """
    df = con.execute(q).df()
    return df.to_dict(orient="records")

def compute_metrics(
    csv_path: str,
    columns: list[str],
    offset: int,
    limit: int,
    metrics: list[str],
) -> dict[str, dict[str, float | int | None]]:
    """
    숫자형이 아닌 값 섞여도 죽지 않게 TRY_CAST로 처리.
    count는 NULL 제외 count.
    """
    con = duckdb.connect(database=":memory:")
    out: dict[str, dict[str, float | int | None]] = {}

    for c in columns:
        qc = quote_ident(c)
        expr = f"TRY_CAST({qc} AS DOUBLE)"

        select_parts = []
        if "avg" in metrics:   select_parts.append(f"AVG({expr}) AS avg")
        if "max" in metrics:   select_parts.append(f"MAX({expr}) AS max")
        if "min" in metrics:   select_parts.append(f"MIN({expr}) AS min")
        if "count" in metrics: select_parts.append(f"COUNT({expr}) AS count")

        if not select_parts:
            raise ValueError("no metrics")

        q = f"""
          SELECT {", ".join(select_parts)}
          FROM (
            SELECT {qc}
            FROM read_csv_auto('{csv_path}')
            LIMIT {limit} OFFSET {offset}
          )
        """
        row = con.execute(q).fetchone()
        keys = [p.split(" AS ")[-1] for p in select_parts]
        out[c] = {k: v for k, v in zip(keys, row)}

    return out
