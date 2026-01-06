"""DuckDB를 사용한 CSV 쿼리 엔진"""
import duckdb
from typing import List, Dict, Any, Optional
from pathlib import Path


def quote_ident(name: str) -> str:
    """식별자 따옴표 처리"""
    return f'"{name}"'


def preview_rows(
    csv_path: str,
    offset: int = 0,
    limit: int = 2000,
    columns: Optional[List[str]] = None,
) -> tuple[List[Dict[str, Any]], List[str]]:
    """CSV 미리보기"""
    conn = duckdb.connect()
    
    try:
        # 경로 정규화 (Windows 경로 처리)
        csv_path_normalized = str(Path(csv_path).resolve())
        
        # 컬럼 목록 조회
        if columns is None:
            try:
                # DuckDB의 DESCRIBE 사용
                col_query = f"DESCRIBE SELECT * FROM read_csv_auto('{csv_path_normalized}')"
                col_result = conn.execute(col_query).fetchall()
                columns = [row[0] for row in col_result]
            except Exception:
                # DESCRIBE 실패 시 실제 데이터 1행을 읽어서 컬럼 추출
                test_query = f"SELECT * FROM read_csv_auto('{csv_path_normalized}') LIMIT 1"
                result = conn.execute(test_query)
                columns = [desc[0] for desc in result.description]
                result.close()
        
        # 컬럼 선택
        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            query = f"""
            SELECT {col_list}
            FROM read_csv_auto('{csv_path_normalized}')
            LIMIT {limit} OFFSET {offset}
            """
        else:
            query = f"""
            SELECT *
            FROM read_csv_auto('{csv_path_normalized}')
            LIMIT {limit} OFFSET {offset}
            """
        
        result = conn.execute(query).fetchall()
        
        # 딕셔너리로 변환 (None 값을 빈 문자열로 변환하지 않음)
        rows = []
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i] if i < len(row) else None
                row_dict[col] = value
            rows.append(row_dict)
        
        return rows, columns
    finally:
        conn.close()


def compute_metrics(
    csv_path: str,
    columns: List[str],
    row_start: int = 0,
    row_end: Optional[int] = None,
) -> Dict[str, Dict[str, Any]]:
    """통계 계산"""
    conn = duckdb.connect()
    metrics = {}
    
    try:
        # 경로 정규화
        csv_path_normalized = str(Path(csv_path).resolve())
        
        # 서브쿼리로 범위 지정 (더 정확함)
        if row_end is not None:
            limit_count = row_end - row_start
            subquery = f"""
            SELECT * FROM read_csv_auto('{csv_path_normalized}')
            LIMIT {limit_count} OFFSET {row_start}
            """
        else:
            subquery = f"""
            SELECT * FROM read_csv_auto('{csv_path_normalized}')
            OFFSET {row_start}
            """
        
        for col in columns:
            col_quoted = quote_ident(col)
            
            try:
                # 기본 통계
                query = f"""
                SELECT 
                    COUNT(*) as count,
                    COUNT({col_quoted}) as non_null_count,
                    MIN({col_quoted}) as min_val,
                    MAX({col_quoted}) as max_val,
                    AVG(TRY_CAST({col_quoted} AS DOUBLE)) as avg_val,
                    STDDEV(TRY_CAST({col_quoted} AS DOUBLE)) as stddev_val
                FROM ({subquery})
                """
                
                result = conn.execute(query).fetchone()
                
                metrics[col] = {
                    "count": int(result[0]) if result[0] is not None else 0,
                    "non_null_count": int(result[1]) if result[1] is not None else 0,
                    "min": float(result[2]) if result[2] is not None else None,
                    "max": float(result[3]) if result[3] is not None else None,
                    "avg": float(result[4]) if result[4] is not None else None,
                    "stddev": float(result[5]) if result[5] is not None else None,
                }
            except Exception as e:
                metrics[col] = {"error": str(e)}
    finally:
        conn.close()
    
    return metrics

